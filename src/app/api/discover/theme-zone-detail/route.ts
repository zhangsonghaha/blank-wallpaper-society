import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { getOrSet, CacheKeys, CacheTTL } from "@/lib/redis";

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

    const cacheKey = CacheKeys.THEME_ZONE_DETAIL(zoneKey, page, limit);

    const result = await getOrSet(cacheKey, async () => {
      // 从 system_settings 读取主题专区配置
      const settings = await db
        .selectFrom("system_settings")
        .select("setting_value")
        .where("setting_key", "=", "theme_zones")
        .execute();

      let themeZones: any[] = [];
      if (settings.length > 0 && settings[0].setting_value) {
        try { themeZones = JSON.parse(settings[0].setting_value); } catch {}
      }

      const zone = themeZones.find((z: any) => z.key === zoneKey);
      if (!zone) {
        return null; // 主题专区不存在
      }

      // 解析分类条件
      const categorySlugs: string[] = zone.categories && Array.isArray(zone.categories) && zone.categories.length > 0
        ? zone.categories
        : zone.category
          ? [zone.category]
          : [];

      // 获取手动关联图片 ID（用于去重）
      const manualIds = await db
        .selectFrom("theme_zone_images")
        .select("image_id")
        .where("zone_key", "=", zoneKey)
        .distinct()
        .execute();
      const manualIdList = manualIds.map((r) => r.image_id);

      // 手动关联图片（当前页）
      const manualImages = await db
        .selectFrom("theme_zone_images as tzi")
        .innerJoin("images as i", "i.id", "tzi.image_id")
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
          "i.tags",
          "i.author",
        ])
        .where("tzi.zone_key", "=", zoneKey)
        .where("i.status", "=", "approved")
        .where("i.media_type", "!=", "video")
        .orderBy("tzi.sort_order", "asc")
        .orderBy("i.download_count", "desc")
        .execute();

      // 分类匹配图片（排除手动关联的，避免重复）
      let categoryImages: any[] = [];
      if (categorySlugs.length > 0) {
        const excludeClause = manualIdList.length > 0
          ? sql`AND i.id NOT IN (${sql.join(manualIdList)})`
          : sql``;

        categoryImages = (await sql`
          SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
            i.category, i.view_count, i.download_count, i.dominant_color, i.tags,
            i.author
          FROM images i
          WHERE i.status = 'approved' AND i.media_type != 'video'
          AND (i.category IN (${sql.join(categorySlugs)}) OR i.category IN (SELECT c.name FROM categories c WHERE c.slug IN (${sql.join(categorySlugs)})))
          ${excludeClause}
          ORDER BY i.download_count DESC, i.view_count DESC
        `.execute(db)).rows as any[];
      }

      // 获取封面图
      let coverImage: any = null;
      if (zone.cover_image_id) {
        const coverResult = await db
          .selectFrom("images")
          .select(["id", "url", "thumbnail_url"])
          .where("id", "=", zone.cover_image_id)
          .where("status", "=", "approved")
          .execute();
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

      return {
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
      };
    }, CacheTTL.THEME_ZONE_DETAIL);

    // getOrSet 返回 null 说明专区不存在
    if (result === null) {
      return NextResponse.json({ error: "主题专区不存在" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/discover/theme-zone-detail error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}
