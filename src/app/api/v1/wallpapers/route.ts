import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateApiRequest, recordUsage } from "@/lib/api-auth";

// GET /api/v1/wallpapers - 壁纸列表
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return auth.error!;
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "24"), 100);
    const offset = (page - 1) * limit;
    const sort = searchParams.get("sort") || "newest"; // newest, popular, downloads

    let sql = "SELECT * FROM images WHERE status = 'approved'";
    const params: any[] = [];

    if (category && category !== "all") {
      sql += " AND category = ?";
      params.push(category);
    }

    if (search) {
      sql += " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    // 排序
    switch (sort) {
      case "popular":
        sql += " ORDER BY view_count DESC, created_at DESC";
        break;
      case "downloads":
        sql += " ORDER BY download_count DESC, created_at DESC";
        break;
      case "newest":
      default:
        sql += " ORDER BY created_at DESC";
    }

    // 获取总数
    const countWhere = sql.replace("SELECT *", "SELECT COUNT(*) as total").split("ORDER BY")[0];
    const countResult = (await query(countWhere, params)) as any[];
    const total = countResult[0]?.total || 0;

    sql += " LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = (await query(sql, params)) as any[];

    // 格式化响应（隐藏内部字段）
    const wallpapers = rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      url: row.url,
      thumbnail_url: row.thumbnail_url,
      width: row.width,
      height: row.height,
      file_size: row.file_size,
      author: row.author,
      tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
      category: row.category,
      dominant_color: row.dominant_color,
      view_count: row.view_count,
      download_count: row.download_count,
      created_at: row.created_at,
    }));

    recordUsage(auth.apiKeyInfo?.id, "/api/v1/wallpapers", auth.ipAddress, 200);

    return NextResponse.json(
      {
        success: true,
        data: wallpapers,
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
    recordUsage(auth.apiKeyInfo?.id, "/api/v1/wallpapers", auth.ipAddress, 500);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}