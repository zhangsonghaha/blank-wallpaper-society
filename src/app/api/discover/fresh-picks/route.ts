import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/discover/fresh-picks - 获取新人专区（新用户上传的高质量壁纸）
export async function GET() {
  try {
    // 获取注册30天内的新用户上传的热门壁纸
    const images = (await query(
      `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
        i.category, i.view_count, i.download_count, i.dominant_color,
        i.created_at,
        u.id as author_id, u.name as author_name, u.avatar as author_avatar,
        u.created_at as author_joined
      FROM images i
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.status = 'approved'
        AND i.media_type != 'video'
        AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY i.download_count DESC, i.view_count DESC LIMIT 12`
    )) as any[];

    // 如果新用户壁纸不够，补充最近上传的壁纸
    let result = images;
    if (result.length < 8) {
      const recentImages = (await query(
        `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
          i.category, i.view_count, i.download_count, i.dominant_color,
          i.created_at,
          u.id as author_id, u.name as author_name, u.avatar as author_avatar,
          u.created_at as author_joined
        FROM images i
        LEFT JOIN users u ON i.uploaded_by = u.id
        WHERE i.status = 'approved'
          AND i.media_type != 'video'
          AND i.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY i.created_at DESC LIMIT 12`
      )) as any[];

      const existingIds = new Set(result.map((img: any) => img.id));
      const additional = recentImages.filter((img: any) => !existingIds.has(img.id));
      result = [...result, ...additional].slice(0, 12);
    }

    // 统计新创作者数量
    const [stats] = (await query(
      `SELECT COUNT(DISTINCT uploaded_by) as newCreatorCount
       FROM images
       WHERE status = 'approved'
         AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    )) as any[];

    return NextResponse.json({
      data: result,
      newCreatorCount: stats?.newCreatorCount || 0,
    });
  } catch (error: any) {
    console.error("GET /api/discover/fresh-picks error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}