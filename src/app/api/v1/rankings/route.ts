import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateApiRequest, recordUsage } from "@/lib/api-auth";

function getDateCondition(period: string): string {
  switch (period) {
    case "daily":
      return "AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
    case "weekly":
      return "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    case "monthly":
      return "AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    case "all":
    default:
      return "";
  }
}

// GET /api/v1/rankings - 排行榜
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return auth.error!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "weekly";
    const type = searchParams.get("type") || "downloads";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let rows: any[];

    if (type === "favorites") {
      const sql = `
        SELECT 
          i.id, i.title, i.description, i.url, i.thumbnail_url, 
          i.width, i.height, i.author, i.tags, i.category,
          i.download_count, i.view_count,
          i.is_favorite AS favorite_count
        FROM images i
        WHERE i.status = 'approved' AND i.is_favorite = 1
        ORDER BY i.download_count DESC, i.view_count DESC
        LIMIT ?
      `;
      rows = (await query(sql, [String(limit)])) as any[];
    } else {
      const logTable = type === "views" ? "view_logs" : "download_logs";
      const dateCondition = getDateCondition(period);

      const sql = `
        SELECT 
          i.id, i.title, i.description, i.url, i.thumbnail_url, 
          i.width, i.height, i.author, i.tags, i.category,
          i.download_count, i.view_count,
          l.log_count
        FROM images i
        INNER JOIN (
          SELECT image_id, COUNT(*) AS log_count
          FROM ${logTable}
          WHERE 1=1 ${dateCondition}
          GROUP BY image_id
          ORDER BY log_count DESC
          LIMIT ?
        ) l ON l.image_id = i.id
        WHERE i.status = 'approved'
        ORDER BY l.log_count DESC
      `;
      rows = (await query(sql, [String(limit)])) as any[];
    }

    const rankings = rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      title: row.title,
      description: row.description,
      thumbnail_url: row.thumbnail_url,
      width: row.width,
      height: row.height,
      author: row.author,
      tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
      category: row.category,
      download_count: row.download_count,
      view_count: row.view_count,
      log_count: row.log_count || 0,
    }));

    recordUsage(auth.apiKeyInfo?.id, "/api/v1/rankings", auth.ipAddress, 200);

    return NextResponse.json(
      {
        success: true,
        data: rankings,
        meta: { period, type },
      },
      { headers: auth.rateLimitHeaders }
    );
  } catch (error: any) {
    recordUsage(auth.apiKeyInfo?.id, "/api/v1/rankings", auth.ipAddress, 500);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}