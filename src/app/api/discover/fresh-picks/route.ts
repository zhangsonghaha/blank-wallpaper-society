import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET /api/discover/fresh-picks - 获取新人专区（新用户上传的高质量壁纸）
export async function GET() {
  try {
    // 获取注册30天内的新用户上传的热门壁纸
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
        "i.created_at",
        "u.id as author_id",
        "u.name as author_name",
        "u.avatar as author_avatar",
        "u.created_at as author_joined",
      ])
      .where("i.status", "=", "approved")
      .where("i.media_type", "!=", "video")
      .where("u.created_at", ">=", sql<Date>`DATE_SUB(NOW(), INTERVAL 30 DAY)`)
      .orderBy("i.download_count", "desc")
      .orderBy("i.view_count", "desc")
      .limit(12)
      .execute();

    // 如果新用户壁纸不够，补充最近上传的壁纸
    let result = images;
    if (result.length < 8) {
      const recentImages = await db
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
          "i.created_at",
          "u.id as author_id",
          "u.name as author_name",
          "u.avatar as author_avatar",
          "u.created_at as author_joined",
        ])
        .where("i.status", "=", "approved")
        .where("i.media_type", "!=", "video")
        .where("i.created_at", ">=", sql<Date>`DATE_SUB(NOW(), INTERVAL 7 DAY)`)
        .orderBy("i.created_at", "desc")
        .limit(12)
        .execute();

      const existingIds = new Set(result.map((img: any) => img.id));
      const additional = recentImages.filter((img: any) => !existingIds.has(img.id));
      result = [...result, ...additional].slice(0, 12);
    }

    // 统计新创作者数量
    const statsResult = await db
      .selectFrom("images")
      .select((eb) => [
        eb.fn.count<number>("uploaded_by").distinct().as("newCreatorCount"),
      ])
      .where("status", "=", "approved")
      .where("created_at", ">=", sql<Date>`DATE_SUB(NOW(), INTERVAL 30 DAY)`)
      .executeTakeFirst();

    return NextResponse.json({
      data: result,
      newCreatorCount: Number(statsResult?.newCreatorCount ?? 0),
    });
  } catch (error: any) {
    console.error("GET /api/discover/fresh-picks error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}
