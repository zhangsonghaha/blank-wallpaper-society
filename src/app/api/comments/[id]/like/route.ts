import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/comments/[id]/like - 点赞评论
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    const { id } = await params;
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return NextResponse.json({ error: "无效的评论ID" }, { status: 400 });
    }
    await query("UPDATE comments SET like_count = like_count + 1 WHERE id = ?", [commentId]);
    const rows = (await query("SELECT like_count FROM comments WHERE id = ?", [commentId])) as any[];
    return NextResponse.json({ success: true, likeCount: rows[0]?.like_count || 0 });
  } catch (error: any) {
    console.error("POST /api/comments/[id]/like error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}