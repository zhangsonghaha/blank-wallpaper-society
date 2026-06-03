import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { delCache, clearPattern, CacheKeys } from "@/lib/redis";

// GET /api/admin/theme-zones/images?zone_key=xxx - 获取指定专区的手动图片列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const zoneKey = request.nextUrl.searchParams.get("zone_key");
    if (!zoneKey) {
      return NextResponse.json({ error: "缺少 zone_key 参数" }, { status: 400 });
    }

    const images = await sql<{
      id: number; image_id: number; sort_order: number; added_at: string;
      title: string; thumbnail_url: string; url: string; width: number; height: number; category: string;
    }>`SELECT 
        tzi.id, tzi.image_id, tzi.sort_order, tzi.added_at,
        i.title, i.thumbnail_url, i.url, i.width, i.height, i.category
      FROM theme_zone_images tzi
      JOIN images i ON tzi.image_id = i.id
      WHERE tzi.zone_key = ${zoneKey}
      ORDER BY tzi.sort_order ASC, tzi.added_at DESC`.execute(db);

    return NextResponse.json({ data: images.rows });
  } catch (error: any) {
    console.error("GET /api/admin/theme-zones/images error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// POST /api/admin/theme-zones/images - 添加图片到专区
// body: { zone_key: string, image_ids: number[] }
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const { zone_key, image_ids } = await request.json();

    if (!zone_key || !Array.isArray(image_ids) || image_ids.length === 0) {
      return NextResponse.json(
        { error: "请提供 zone_key 和 image_ids" },
        { status: 400 }
      );
    }

    // 批量插入，忽略重复 — 使用 raw SQL for INSERT IGNORE
    const tuples = image_ids.map((id: number) => sql`(${zone_key}, ${id})`);
    await sql`INSERT IGNORE INTO theme_zone_images (zone_key, image_id) VALUES ${sql.join(tuples)}`.execute(db);

    // 失效主题专区前端缓存
    await Promise.all([
      delCache(CacheKeys.THEME_ZONES),
      clearPattern("discover:theme-zone-detail:*"),
    ]);

    return NextResponse.json({ success: true, added: image_ids.length });
  } catch (error: any) {
    console.error("POST /api/admin/theme-zones/images error:", error);
    return NextResponse.json({ error: error.message || "添加失败" }, { status: 500 });
  }
}

// DELETE /api/admin/theme-zones/images - 从专区移除图片
// body: { zone_key: string, image_ids: number[] }
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const { zone_key, image_ids } = await request.json();

    if (!zone_key || !Array.isArray(image_ids) || image_ids.length === 0) {
      return NextResponse.json(
        { error: "请提供 zone_key 和 image_ids" },
        { status: 400 }
      );
    }

    await db.deleteFrom("theme_zone_images")
      .where("zone_key", "=", zone_key)
      .where("image_id", "in", image_ids as number[])
      .execute();

    // 失效主题专区前端缓存
    await Promise.all([
      delCache(CacheKeys.THEME_ZONES),
      clearPattern("discover:theme-zone-detail:*"),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/theme-zones/images error:", error);
    return NextResponse.json({ error: error.message || "删除失败" }, { status: 500 });
  }
}
