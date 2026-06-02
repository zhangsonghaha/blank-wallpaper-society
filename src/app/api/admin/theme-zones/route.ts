import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/admin/theme-zones - 获取所有主题专区（管理端）
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 从 system_settings 读取主题专区配置
    const settings = (await query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'theme_zones'"
    )) as any[];

    let zones: any[] = [];
    if (settings.length > 0 && settings[0].setting_value) {
      try {
        zones = JSON.parse(settings[0].setting_value);
      } catch {
        zones = [];
      }
    }

    // 默认主题专区
    if (zones.length === 0) {
      zones = [
        { key: "nature", title: "自然风光", subtitle: "山川湖海，四季轮转", category: "nature", icon: "🏔️", enabled: true, sort_order: 0 },
        { key: "minimal", title: "极简美学", subtitle: "少即是多，留白之美", category: "minimal", icon: "✨", enabled: true, sort_order: 1 },
        { key: "city", title: "城市建筑", subtitle: "钢铁森林，光影交错", category: "city", icon: "🏙️", enabled: true, sort_order: 2 },
        { key: "art", title: "艺术创作", subtitle: "灵感无限，创意无界", category: "art", icon: "🎨", enabled: true, sort_order: 3 },
      ];
    }

    // 为每个主题专区获取统计信息
    const zonesWithData = await Promise.all(
      zones.map(async (zone: any) => {
        try {
          // 构建查询条件
          const conditions: string[] = [];
          const params: any[] = [];

          conditions.push("i.status = 'approved'");
          conditions.push("i.media_type != 'video'");

          // 多分类匹配
          if (zone.categories && Array.isArray(zone.categories) && zone.categories.length > 0) {
            const placeholders = zone.categories.map(() => "?").join(", ");
            conditions.push(`i.category IN (${placeholders})`);
            params.push(...zone.categories);
          } else if (zone.category) {
            // 兼容旧版单分类
            conditions.push("i.category = ?");
            params.push(zone.category);
          }

          // 标签匹配（可选）
          if (zone.tags && Array.isArray(zone.tags) && zone.tags.length > 0) {
            const tagConditions = zone.tags.map(() => "i.tags LIKE ?").join(" OR ");
            conditions.push(`(${tagConditions})`);
            params.push(...zone.tags.map((tag: string) => `%${tag}%`));
          }

          const whereClause = conditions.join(" AND ");

          // 查询图片数量
          const [countResult] = (await query(
            `SELECT COUNT(*) as total FROM images i WHERE ${whereClause}`,
            params
          )) as any[];

          // 查询手动添加的图片数量
          const [manualCountResult] = (await query(
            `SELECT COUNT(*) as total FROM theme_zone_images WHERE zone_key = ?`,
            [zone.key]
          )) as any[];

          // 封面图：优先使用自定义封面，否则取下载量最高的图片
          let coverUrl = null;
          let coverThumbnailUrl = null;

          if (zone.cover_image_id) {
            const coverImage = (await query(
              `SELECT url, thumbnail_url FROM images WHERE id = ?`,
              [zone.cover_image_id]
            )) as any[];
            if (coverImage.length > 0) {
              coverUrl = coverImage[0].url;
              coverThumbnailUrl = coverImage[0].thumbnail_url;
            }
          }

          if (!coverUrl) {
            const coverImages = (await query(
              `SELECT i.id, i.url, i.thumbnail_url, i.width, i.height
              FROM images i
              WHERE ${whereClause}
              ORDER BY i.download_count DESC, i.view_count DESC
              LIMIT 1`,
              params
            )) as any[];
            coverUrl = coverImages[0]?.url || null;
            coverThumbnailUrl = coverImages[0]?.thumbnail_url || null;
          }

          return {
            ...zone,
            categories: zone.categories || (zone.category ? [zone.category] : []),
            image_count: (countResult?.total || 0) + (manualCountResult?.total || 0),
            manual_image_count: manualCountResult?.total || 0,
            cover_url: coverUrl,
            cover_thumbnail_url: coverThumbnailUrl,
          };
        } catch (error) {
          console.error(`Error fetching data for zone ${zone.key}:`, error);
          return {
            ...zone,
            categories: zone.categories || (zone.category ? [zone.category] : []),
            image_count: 0,
            cover_url: null,
            cover_thumbnail_url: null,
          };
        }
      })
    );

    // 计算统计信息
    const stats = {
      total: zonesWithData.length,
      enabled: zonesWithData.filter(z => z.enabled !== false).length,
      disabled: zonesWithData.filter(z => z.enabled === false).length,
    };

    return NextResponse.json({ data: zonesWithData, stats });
  } catch (error: any) {
    console.error("GET /api/admin/theme-zones error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// PUT /api/admin/theme-zones - 更新主题专区配置
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const body = await request.json();
    const { zones } = body;

    // 验证输入
    if (!Array.isArray(zones)) {
      return NextResponse.json({ error: "zones 必须为数组" }, { status: 400 });
    }

    if (zones.length > 8) {
      return NextResponse.json({ error: "主题专区最多 8 个" }, { status: 400 });
    }

    // 验证每个专区
    const keyRegex = /^[a-z0-9]{2,30}$/;
    const keys = new Set<string>();

    for (const zone of zones) {
      if (!zone.key || !zone.title) {
        return NextResponse.json({ error: "每个专区必须有 key 和 title" }, { status: 400 });
      }

      if (!keyRegex.test(zone.key)) {
        return NextResponse.json({ error: `Key "${zone.key}" 格式无效，必须为小写字母和数字，长度 2-30` }, { status: 400 });
      }

      if (keys.has(zone.key)) {
        return NextResponse.json({ error: `存在重复的 Key: "${zone.key}"` }, { status: 400 });
      }
      keys.add(zone.key);

      if (zone.title.length < 1 || zone.title.length > 50) {
        return NextResponse.json({ error: `标题 "${zone.title}" 长度必须在 1-50 字符之间` }, { status: 400 });
      }

      if (zone.subtitle && (zone.subtitle.length < 1 || zone.subtitle.length > 100)) {
        return NextResponse.json({ error: `副标题 "${zone.subtitle}" 长度必须在 1-100 字符之间` }, { status: 400 });
      }

      if (!zone.categories || !Array.isArray(zone.categories) || zone.categories.length === 0) {
        return NextResponse.json({ error: `专区 "${zone.title}" 必须至少关联一个分类` }, { status: 400 });
      }

      if (zone.categories.length > 5) {
        return NextResponse.json({ error: `专区 "${zone.title}" 最多关联 5 个分类` }, { status: 400 });
      }

      if (zone.tags && Array.isArray(zone.tags) && zone.tags.length > 10) {
        return NextResponse.json({ error: `专区 "${zone.title}" 最多 10 个标签` }, { status: 400 });
      }
    }

    // 保存到数据库
    const configValue = JSON.stringify(zones);

    await query(
      `INSERT INTO system_settings (setting_key, setting_value, description)
       VALUES ('theme_zones', ?, '主题专区配置')
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [configValue, configValue]
    );

    return NextResponse.json({ 
      message: "主题专区配置已更新", 
      updated_count: zones.length 
    });
  } catch (error: any) {
    console.error("PUT /api/admin/theme-zones error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}
