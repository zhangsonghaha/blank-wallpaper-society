import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/feed - 获取关注用户的最新作品
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 获取关注用户的最新图片
    const images = (await query(
      `SELECT i.* FROM images i
       INNER JOIN user_follows uf ON i.uploaded_by = uf.following_id
       WHERE uf.follower_id = ? AND i.status = 'approved'
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    )) as any[];

    // 获取总数
    const countRows = (await query(
      `SELECT COUNT(*) AS total FROM images i
       INNER JOIN user_follows uf ON i.uploaded_by = uf.following_id
       WHERE uf.follower_id = ? AND i.status = 'approved'`,
      [userId]
    )) as any[];

    const total = countRows[0]?.total || 0;

    return NextResponse.json({
      data: images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/feed error:", error);
    return NextResponse.json(
      { error: error.message || "获取失败" },
      { status: 500 }
    );
  }
}