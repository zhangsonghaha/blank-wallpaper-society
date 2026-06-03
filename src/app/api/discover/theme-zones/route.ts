import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { getOrSet, delCache, clearPattern, CacheKeys, CacheTTL } from "@/lib/redis";

// GET /api/discover/theme-zones - 获取主题专区数据
export async function GET() {
  try {
    const result = await getOrSet(CacheKeys.THEME_ZONES, async () => {
      // 从 system_settings 读取主题专区配置
      const settings = await db
        .selectFrom("system_settings")
        .select("setting_value")
        .where("setting_key", "=", "theme_zones")
        .execute();

      let themeZones: any[] = [];
      if (settings.length > 0 && settings[0].setting_value) {
        try {
          themeZones = JSON.parse(settings[0].setting_value);
        } catch {}
      }

      // 默认主题专区（基于分类）
      if (themeZones.length === 0) {
        themeZones = [
          { key: "nature", title: "自然风光", subtitle: "山川湖海，四季轮转", category: "nature", icon: "🏔️" },
          { key: "minimal", title: "极简美学", subtitle: "少即是多，留白之美", category: "minimal", icon: "✨" },
          { key: "city", title: "城市建筑", subtitle: "钢铁森林，光影交错", category: "city", icon: "🏙️" },
          { key: "art", title: "艺术创作", subtitle: "灵感无限，创意无界", category: "art", icon: "🎨" },
        ];
      }

      // 为每个主题专区获取代表图片
      const zonesWithData = await Promise.all(
        themeZones.map(async (zone: any) => {
          try {
            // 1. 先获取手动关联的图片（优先级最高）
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
              ])
              .where("tzi.zone_key", "=", zone.key)
              .where("i.status", "=", "approved")
              .where("i.media_type", "!=", "video")
              .orderBy("tzi.sort_order", "asc")
              .orderBy("i.download_count", "desc")
              .limit(6)
              .execute();

            const manualCount = manualImages.length;
            const manualImageIds = manualImages.map((img: any) => img.id);

            // 2. 如果手动图片不足6张，用分类匹配的图片补充
            let categoryImages: any[] = [];
            if (manualCount < 6) {
              // 解析分类条件（兼容旧版 category 字符串和新版 categories 数组）
              const categorySlugs: string[] = zone.categories && Array.isArray(zone.categories) && zone.categories.length > 0
                ? zone.categories
                : zone.category
                  ? [zone.category]
                  : [];

              if (categorySlugs.length > 0) {
                const excludeClause = manualImageIds.length > 0
                  ? sql`AND i.id NOT IN (${sql.join(manualImageIds)})`
                  : sql``;

                const needed = 6 - manualCount;
                categoryImages = (await sql`
                  SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
                    i.category, i.view_count, i.download_count, i.dominant_color
                  FROM images i
                  WHERE i.status = 'approved' AND i.media_type != 'video'
                  AND (i.category IN (${sql.join(categorySlugs)}) OR i.category IN (SELECT c.name FROM categories c WHERE c.slug IN (${sql.join(categorySlugs)})))
                  ${excludeClause}
                  ORDER BY i.download_count DESC, i.view_count DESC LIMIT ${needed}
                `.execute(db)).rows as any[];
              }
            }

            const images = [...manualImages, ...categoryImages];

            // 3. 获取总数（手动 + 分类匹配去重）
            const categorySlugs: string[] = zone.categories && Array.isArray(zone.categories) && zone.categories.length > 0
              ? zone.categories
              : zone.category
                ? [zone.category]
                : [];

            // 手动关联数量
            const manualTotalRow = await db
              .selectFrom("theme_zone_images as tzi")
              .innerJoin("images as i", "i.id", "tzi.image_id")
              .select((eb) => [eb.fn.count<number>("i.id").as("cnt")])
              .where("tzi.zone_key", "=", zone.key)
              .where("i.status", "=", "approved")
              .where("i.media_type", "!=", "video")
              .executeTakeFirst();

            // 分类匹配数量
            let categoryTotal = 0;
            if (categorySlugs.length > 0) {
              const catTotalRow = (await sql`
                SELECT COUNT(*) as cnt FROM images i
                WHERE i.status = 'approved' AND i.media_type != 'video'
                AND (i.category IN (${sql.join(categorySlugs)}) OR i.category IN (SELECT c.name FROM categories c WHERE c.slug IN (${sql.join(categorySlugs)})))
              `.execute(db)).rows as any[];
              categoryTotal = Number(catTotalRow[0]?.cnt || 0);
            }

            // 简单合并（手动图片已去重排除分类图片中的重复）
            const total = Number(manualTotalRow?.cnt || 0) + categoryTotal;

            // 使用第一个分类 slug 作为链接参数
            const linkCategory = categorySlugs[0] || zone.category || zone.key;

            // 处理 enabled 标记（未设置默认为 true）
            const enabled = zone.enabled !== false;

            return {
              ...zone,
              category: linkCategory,
              images,
              total,
              enabled,
            };
          } catch {
            return { ...zone, images: [], total: 0, enabled: zone.enabled !== false };
          }
        })
      );

      // 过滤掉已禁用的专区和没有图片的专区
      return zonesWithData.filter((z) => z.enabled && z.images.length > 0);
    }, CacheTTL.THEME_ZONES);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error("GET /api/discover/theme-zones error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// PUT /api/discover/theme-zones - 管理员设置主题专区
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const body = await request.json();
    const { zones } = body;

    if (!Array.isArray(zones)) {
      return NextResponse.json({ error: "zones必须为数组" }, { status: 400 });
    }
    if (zones.length > 8) {
      return NextResponse.json({ error: "主题专区最多8个" }, { status: 400 });
    }

    // 验证每个专区
    for (const zone of zones) {
      if (!zone.key || !zone.title) {
        return NextResponse.json({ error: "每个专区必须有key和title" }, { status: 400 });
      }
    }

    const configValue = JSON.stringify(zones);

    await sql`
      INSERT INTO system_settings (setting_key, setting_value, description)
       VALUES ('theme_zones', ${configValue}, '主题专区配置')
       ON DUPLICATE KEY UPDATE setting_value = ${configValue}
    `.execute(db);

    // 失效主题专区相关缓存
    await Promise.all([
      delCache(CacheKeys.THEME_ZONES),
      clearPattern("discover:theme-zone-detail:*"),
    ]);

    return NextResponse.json({ message: "主题专区已更新" });
  } catch (error: any) {
    console.error("PUT /api/discover/theme-zones error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}
