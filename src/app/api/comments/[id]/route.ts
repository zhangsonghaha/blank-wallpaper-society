import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// DELETE /api/comments/[id] - 删除评论
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const { id } = await params;
    const commentId = parseInt(id);

    if (isNaN(commentId)) {
      return NextResponse.json({ error: "无效的评论ID" }, { status: 400 });
    }

    // 验证评论存在，且只有评论作者或管理员可以删除
    const comments = (await query(
      "SELECT user_id FROM comments WHERE id = ?",
      [commentId]
    )) as any[];

    if (comments.length === 0) {
      return NextResponse.json({ error: "评论不存在" }, { status: 404 });
    }

    // 管理员或评论作者可删除
    if (comments[0].user_id !== userId && userRole !== "admin" && userRole !== "moderator") {
      return NextResponse.json({ error: "无权限删除此评论" }, { status: 403 });
    }

    // 先删除子评论（回复）
    await query("DELETE FROM comments WHERE parent_id = ?", [commentId]);

    // 再删除评论本身
    await query("DELETE FROM comments WHERE id = ?", [commentId]);

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    console.error("DELETE /api/comments/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}