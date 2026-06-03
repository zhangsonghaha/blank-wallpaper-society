import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

    // Build query
    let query = db.selectFrom("images").selectAll().where("status", "=", "approved");

    if (category && category !== "all") {
      query = query.where("category", "=", category);
    }

    if (search) {
      const like = `%${search}%`;
      query = query.where((eb) => eb.or([
        eb("title", "like", like),
        eb("description", "like", like),
        eb("tags", "like", like),
      ]));
    }

    // Build count query (same filters, no ordering)
    let countQuery = db.selectFrom("images").select((eb) => [eb.fn.count<number>("id").as("total")]).where("status", "=", "approved");
    if (category && category !== "all") {
      countQuery = countQuery.where("category", "=", category);
    }
    if (search) {
      const like = `%${search}%`;
      countQuery = countQuery.where((eb) => eb.or([
        eb("title", "like", like),
        eb("description", "like", like),
        eb("tags", "like", like),
      ]));
    }

    // 排序
    switch (sort) {
      case "popular":
        query = query.orderBy("view_count", "desc").orderBy("created_at", "desc");
        break;
      case "downloads":
        query = query.orderBy("download_count", "desc").orderBy("created_at", "desc");
        break;
      case "newest":
      default:
        query = query.orderBy("created_at", "desc");
    }

    // Execute in parallel
    const [countResult, rows] = await Promise.all([
      countQuery.executeTakeFirst(),
      query.limit(limit).offset(offset).execute(),
    ]);

    const total = Number(countResult?.total ?? 0);

    // 格式化响应（隐藏内部字段）
    const wallpapers = (rows as any[]).map((row: any) => ({
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
