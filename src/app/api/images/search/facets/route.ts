import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sanitizeQueryParam } from "@/lib/sanitize";

// GET /api/images/search/facets - 搜索分面筛选数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") ? sanitizeQueryParam(searchParams.get("q")!) : null;
    const category = searchParams.get("category");

    // 构建基础条件
    const conditions: string[] = ["status = 'approved'"];
    const params: any[] = [];

    if (searchQuery) {
      conditions.push("(title LIKE ? OR description LIKE ? OR tags LIKE ?)");
      const likeQuery = `%${searchQuery}%`;
      params.push(likeQuery, likeQuery, likeQuery);
    }

    if (category && category !== "all") {
      conditions.push("category = ?");
      params.push(category);
    }

    const whereClause = conditions.join(" AND ");

    // 并行获取所有分面数据
    const [categoryFacets, colorFacets, resolutionFacets, totalCount] = await Promise.all([
      query(
        `SELECT category, COUNT(*) as count FROM images WHERE ${whereClause} AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 20`,
        params
      ),
      query(
        `SELECT dominant_color, COUNT(*) as count FROM images WHERE ${whereClause} AND dominant_color IS NOT NULL GROUP BY dominant_color ORDER BY count DESC LIMIT 12`,
        params
      ),
      query(
        `SELECT CASE WHEN width >= 3840 THEN '4K' WHEN width >= 2560 THEN '2K' WHEN width >= 1920 THEN 'FHD' WHEN width >= 1280 THEN 'HD' ELSE 'SD' END as resolution_group, COUNT(*) as count FROM images WHERE ${whereClause} GROUP BY resolution_group ORDER BY MIN(width) DESC`,
        params
      ),
      query(`SELECT COUNT(*) as total FROM images WHERE ${whereClause}`, params),
    ]);

    // 零结果推荐
    let recommendations: any[] = [];
    const total = (totalCount as any[])[0]?.total || 0;
    if (total === 0) {
      const recRows = (await query(
        `SELECT id, title, url, storage_key, thumbnail_key, width, height, category, dominant_color, download_count, view_count FROM images WHERE status = 'approved' ORDER BY RAND() LIMIT 8`
      )) as any[];
      recommendations = recRows.map((r: any) => ({
        id: r.id,
        title: r.title,
        src: r.thumbnail_key ? `https://qq.qinqin.asia/storage/${r.thumbnail_key}` : (r.url || ""),
        width: r.width,
        height: r.height,
        category: r.category,
        dominantColor: r.dominant_color,
        downloadCount: r.download_count,
        viewCount: r.view_count,
      }));
    }

    return NextResponse.json({
      facets: {
        categories: categoryFacets,
        colors: colorFacets,
        resolutions: resolutionFacets,
      },
      total,
      recommendations,
      query: searchQuery,
    });
  } catch (error: any) {
    console.error("GET /api/images/search/facets error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}