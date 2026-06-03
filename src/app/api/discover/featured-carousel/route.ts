import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET /api/discover/featured-carousel - 获取编辑精选轮播数据
export async function GET() {
  try {
    // 从 system_settings 读取编辑精选配置
    const settings = await db
      .selectFrom("system_settings")
      .select("setting_value")
      .where("setting_key", "=", "featured_carousel")
      .execute();

    let carouselIds: number[] = [];
    if (settings.length > 0 && settings[0].setting_value) {
      try {
        const config = JSON.parse(settings[0].setting_value);
        carouselIds = config.imageIds || [];
      } catch {}
    }

    // 如果没有配置，自动选取热门图片
    if (carouselIds.length === 0) {
      const topImages = await db
        .selectFrom("images")
        .select("id")
        .where("status", "=", "approved")
        .where("media_type", "!=", "video")
        .orderBy("download_count", "desc")
        .orderBy("view_count", "desc")
        .limit(8)
        .execute();
      carouselIds = topImages.map((img) => img.id);
    }

    if (carouselIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 获取图片详情
    const images = await db
      .selectFrom("images as i")
      .leftJoin("users as u", "u.id", "i.uploaded_by")
      .select([
        "i.id",
        "i.title",
        "i.url",
        "i.thumbnail_url",
        "i.width",
        "i.height",
        "i.category",
        "i.view_count",
        "i.download_count",
        "i.dominant_color",
        "u.name as author_name",
        "u.avatar as author_avatar",
      ])
      .where("i.id", "in", carouselIds)
      .where("i.status", "=", "approved")
      .execute();

    // 按配置顺序排列
    images.sort((a: any, b: any) => carouselIds.indexOf(a.id) - carouselIds.indexOf(b.id));

    return NextResponse.json({ data: images });
  } catch (error: any) {
    console.error("GET /api/discover/featured-carousel error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// PUT /api/discover/featured-carousel - 管理员设置编辑精选轮播
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const body = await request.json();
    const { imageIds } = body;

    if (!Array.isArray(imageIds)) {
      return NextResponse.json({ error: "imageIds必须为数组" }, { status: 400 });
    }
    if (imageIds.length > 10) {
      return NextResponse.json({ error: "精选轮播最多10张" }, { status: 400 });
    }

    // 验证图片存在
    if (imageIds.length > 0) {
      const validImages = await db
        .selectFrom("images")
        .select("id")
        .where("id", "in", imageIds)
        .where("status", "=", "approved")
        .execute();
      if (validImages.length !== imageIds.length) {
        return NextResponse.json({ error: "部分图片不存在或未审核" }, { status: 400 });
      }
    }

    const configValue = JSON.stringify({ imageIds });

    // Upsert system_settings
    await sql`
      INSERT INTO system_settings (setting_key, setting_value, description)
      VALUES ('featured_carousel', ${configValue}, '编辑精选轮播图片ID列表')
      ON DUPLICATE KEY UPDATE setting_value = ${configValue}
    `.execute(db);

    return NextResponse.json({ message: "编辑精选轮播已更新" });
  } catch (error: any) {
    console.error("PUT /api/discover/featured-carousel error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}
