import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/favorites - 获取当前用户的收藏列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    // 获取总数
    const countResult = await query(
      `SELECT COUNT(*) as total FROM favorites WHERE user_id = ?`,
      [userId]
    );
    const total = (countResult as any[])[0]?.total || 0;

    // 关联images表获取图片详情
    const rows = await query(
      `SELECT f.id as favorite_id, f.created_at as favorited_at,
        i.id, i.title, i.description, i.url, i.thumbnail_url, i.width, i.height,
        i.category, i.tags, i.author, i.view_count, i.download_count,
        i.created_at, i.dominant_color, i.storage_key
      FROM favorites f
      INNER JOIN images i ON f.image_id = i.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}