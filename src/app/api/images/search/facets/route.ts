import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { sanitizeQueryParam } from "@/lib/sanitize";

// GET /api/images/search/facets - 搜索分面筛选数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") ? sanitizeQueryParam(searchParams.get("q")!) : null;
    const category = searchParams.get("category");

    // 构建基础条件
    const conditions: any[] = [sql`status = 'approved'`];

    if (searchQuery) {
      const likeQuery = `%${searchQuery}%`;
      conditions.push(sql`(title LIKE ${likeQuery} OR description LIKE ${likeQuery} OR tags LIKE ${likeQuery})`);
    }

    if (category && category !== "all") {
      conditions.push(sql`category = ${category}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // 并行获取所有分面数据
    const [categoryResult, colorResult, resolutionResult, totalCountResult] = await Promise.all([
      sql<{ category: string; count: number }>`SELECT category, COUNT(*) as count FROM images WHERE ${whereClause} AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 20`.execute(db),
      sql<{ dominant_color: string; count: number }>`SELECT dominant_color, COUNT(*) as count FROM images WHERE ${whereClause} AND dominant_color IS NOT NULL GROUP BY dominant_color ORDER BY count DESC LIMIT 12`.execute(db),
      sql<{ resolution_group: string; count: number }>`SELECT CASE WHEN width >= 3840 THEN '4K' WHEN width >= 2560 THEN '2K' WHEN width >= 1920 THEN 'FHD' WHEN width >= 1280 THEN 'HD' ELSE 'SD' END as resolution_group, COUNT(*) as count FROM images WHERE ${whereClause} GROUP BY resolution_group ORDER BY MIN(width) DESC`.execute(db),
      sql<{ total: number }>`SELECT COUNT(*) as total FROM images WHERE ${whereClause}`.execute(db),
    ]);

    const categoryFacets = categoryResult.rows;
    const colorFacets = colorResult.rows;
    const resolutionFacets = resolutionResult.rows;

    // 零结果推荐
    let recommendations: any[] = [];
    const total = Number(totalCountResult.rows[0]?.total ?? 0);
    if (total === 0) {
      const recRows = await db
        .selectFrom("images")
        .where("status", "=", "approved")
        .orderBy(sql`RAND()`)
        .limit(8)
        .select(["id", "title", "url", "storage_key", "width", "height", "category", "dominant_color", "download_count", "view_count"])
        .execute();
      recommendations = recRows.map((r) => ({
        id: r.id,
        title: r.title,
        src: r.storage_key ? `https://qq.qinqin.asia/storage/${r.storage_key}` : (r.url || ""),
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
