import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/posts/[id]/like - 点赞/取消点赞
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const { id } = await params;
    const postId = parseInt(id);

    // 检查帖子是否存在
    const post = await query("SELECT id FROM posts WHERE id = ?", [postId]) as any[];
    if (post.length === 0) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 检查是否已点赞
    const existing = await query(
      "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?",
      [postId, userId]
    ) as any[];

    if (existing.length > 0) {
      // 取消点赞
      await query("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
      await query("UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?", [postId]);
      return NextResponse.json({ liked: false, message: "已取消点赞" });
    } else {
      // 点赞
      await query("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
      await query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?", [postId]);
      return NextResponse.json({ liked: true, message: "点赞成功" });
    }

  } catch (error: any) {
    console.error("POST /api/posts/[id]/like error:", error);
    return NextResponse.json({ error: error.message || "操作失败" }, { status: 500 });
  }
}