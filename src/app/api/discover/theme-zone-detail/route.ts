import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/discover/theme-zone-detail?zone_key=xxx&page=1&limit=24
export async function GET(request: NextRequest) {
  try {
    const zoneKey = request.nextUrl.searchParams.get("zone_key");
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.min(48, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "24")));
    const offset = (page - 1) * limit;

    if (!zoneKey) {
      return NextResponse.json({ error: "缺少 zone_key 参数" }, { status: 400 });
    }

    // 从 system_settings 读取主题专区配置
    const settings = (await query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'theme_zones'"
    )) as any[];

    let themeZones: any[] = [];
    if (settings.length > 0 && settings[0].setting_value) {
      try { themeZones = JSON.parse(settings[0].setting_value); } catch {}
    }

    const zone = themeZones.find((z: any) => z.key === zoneKey);
    if (!zone) {
      return NextResponse.json({ error: "主题专区不存在" }, { status: 404 });
    }

    // 解析分类条件
    const categorySlugs: string[] = zone.categories && Array.isArray(zone.categories) && zone.categories.length > 0
      ? zone.categories
      : zone.category
        ? [zone.category]
        : [];

    // 获取手动关联图片 ID（用于去重）
    const manualIds = (await query(
      `SELECT DISTINCT image_id FROM theme_zone_images WHERE zone_key = ?`,
      [zoneKey]
    )) as any[];
    const manualIdList = manualIds.map((r: any) => r.image_id);

    // 手动关联图片（当前页）
    const manualImages = (await query(
      `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
        i.category, i.view_count, i.download_count, i.dominant_color, i.tags,
        i.author
      FROM theme_zone_images tzi
      JOIN images i ON tzi.image_id = i.id
      WHERE tzi.zone_key = ? AND i.status = 'approved' AND i.media_type != 'video'
      ORDER BY tzi.sort_order ASC, i.download_count DESC`,
      [zoneKey]
    )) as any[];

    // 分类匹配图片（排除手动关联的，避免重复）
    let categoryImages: any[] = [];
    if (categorySlugs.length > 0) {
      const placeholders = categorySlugs.map(() => "?").join(", ");
      const excludeClause = manualIdList.length > 0
        ? `AND i.id NOT IN (${manualIdList.map(() => "?").join(", ")})`
        : "";

      categoryImages = (await query(
        `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
          i.category, i.view_count, i.download_count, i.dominant_color, i.tags,
          i.author
        FROM images i
        WHERE i.status = 'approved' AND i.media_type != 'video'
        AND (i.category IN (${placeholders}) OR i.category IN (SELECT c.name FROM categories c WHERE c.slug IN (${placeholders})))
        ${excludeClause}
        ORDER BY i.download_count DESC, i.view_count DESC`,
        [...categorySlugs, ...categorySlugs, ...manualIdList]
      )) as any[];
    }

    // 获取封面图
    let coverImage: any = null;
    if (zone.cover_image_id) {
      const coverResult = (await query(
        `SELECT id, url, thumbnail_url FROM images WHERE id = ? AND status = 'approved'`,
        [zone.cover_image_id]
      )) as any[];
      if (coverResult.length > 0) coverImage = coverResult[0];
    }
    // 无自定义封面时使用第一张图作为封面
    if (!coverImage && manualImages.length > 0) {
      coverImage = { id: manualImages[0].id, url: manualImages[0].url, thumbnail_url: manualImages[0].thumbnail_url };
    } else if (!coverImage && categoryImages.length > 0) {
      coverImage = { id: categoryImages[0].id, url: categoryImages[0].url, thumbnail_url: categoryImages[0].thumbnail_url };
    }

    // 合并并分页
    const allImages = [...manualImages, ...categoryImages];
    const total = allImages.length;
    const paged = allImages.slice(offset, offset + limit);

    return NextResponse.json({
      data: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      zone: {
        key: zone.key,
        title: zone.title,
        subtitle: zone.subtitle || "",
        icon: zone.icon || "",
        categories: zone.categories || [],
        tags: zone.tags || [],
        cover: coverImage ? {
          id: coverImage.id,
          url: coverImage.url,
          thumbnail_url: coverImage.thumbnail_url,
        } : null,
      },
    });
  } catch (error: any) {
    console.error("GET /api/discover/theme-zone-detail error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}
