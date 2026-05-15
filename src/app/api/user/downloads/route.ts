import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/user/downloads - 获取当前用户的下载历史
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

    // 查询下载历史，关联图片信息
    const rows = (await query(
      `SELECT dl.id, dl.resolution, dl.created_at AS downloaded_at,
              i.id AS image_id, i.title, i.url, i.thumbnail_url,
              i.width, i.height, i.author, i.category, i.dominant_color
       FROM download_logs dl
       JOIN images i ON dl.image_id = i.id
       WHERE dl.user_id = ?
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    )) as any[];

    // 查询总数
    const countRows = (await query(
      "SELECT COUNT(*) AS total FROM download_logs WHERE user_id = ?",
      [userId]
    )) as any[];

    const total = countRows[0]?.total || 0;

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/user/downloads error:", error);
    return NextResponse.json(
      { error: error.message || "获取下载历史失败" },
      { status: 500 }
    );
  }
}