import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateApiRequest, recordUsage } from "@/lib/api-auth";

// GET /api/v1/collections - 合集列表
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return auth.error!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 50);
    const offset = (page - 1) * limit;
    const featured = searchParams.get("featured") === "true";

    let sql = `
      SELECT c.*, 
        u.name as author_name, u.avatar as author_avatar,
        i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN images i ON c.cover_image_id = i.id
      WHERE c.is_public = TRUE
    `;
    const params: any[] = [];

    if (featured) {
      sql += " ORDER BY subscriber_count DESC, c.created_at DESC";
    } else {
      sql += " ORDER BY c.created_at DESC";
    }

    // 获取总数
    const countResult = (await query(
      "SELECT COUNT(*) as total FROM collections WHERE is_public = TRUE"
    )) as any[];
    const total = countResult[0]?.total || 0;

    sql += " LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = (await query(sql, params)) as any[];

    const collections = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      cover_url: row.cover_url,
      cover_thumbnail_url: row.cover_thumbnail_url,
      author: {
        name: row.author_name,
        avatar: row.author_avatar,
      },
      image_count: row.image_count,
      subscriber_count: row.subscriber_count,
      is_public: row.is_public,
      created_at: row.created_at,
    }));

    recordUsage(auth.apiKeyInfo?.id, "/api/v1/collections", auth.ipAddress, 200);

    return NextResponse.json(
      {
        success: true,
        data: collections,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: auth.rateLimitHeaders }
    );
  } catch (error: any) {
    recordUsage(auth.apiKeyInfo?.id, "/api/v1/collections", auth.ipAddress, 500);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}