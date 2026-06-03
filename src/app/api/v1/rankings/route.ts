import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
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
      rows = await db
        .selectFrom("images as i")
        .select([
          "i.id",
          "i.title",
          "i.description",
          "i.url",
          "i.thumbnail_url",
          "i.width",
          "i.height",
          "i.author",
          "i.tags",
          "i.category",
          "i.download_count",
          "i.view_count",
          "i.favorite_count",
        ])
        .where("i.status", "=", "approved")
        .where("i.favorite_count", ">", 0)
        .orderBy("i.favorite_count", "desc")
        .orderBy("i.download_count", "desc")
        .limit(limit)
        .execute() as any[];
    } else {
      const logTable = type === "views" ? "view_logs" : "download_logs";
      const dateCondition = getDateCondition(period);

      rows = (await sql`
        SELECT
          i.id, i.title, i.description, i.url, i.thumbnail_url,
          i.width, i.height, i.author, i.tags, i.category,
          i.download_count, i.view_count,
          l.log_count
        FROM images i
        INNER JOIN (
          SELECT image_id, COUNT(*) AS log_count
          FROM ${sql.raw(logTable)}
          WHERE 1=1 ${sql.raw(dateCondition)}
          GROUP BY image_id
          ORDER BY log_count DESC
          LIMIT ${limit}
        ) l ON l.image_id = i.id
        WHERE i.status = 'approved'
        ORDER BY l.log_count DESC
      `.execute(db)).rows as any[];
    }

    const rankings = rows.map((row: any, index: number) => ({
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
