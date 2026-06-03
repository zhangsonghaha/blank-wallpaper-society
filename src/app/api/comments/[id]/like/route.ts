import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
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
    await db
      .updateTable("comments")
      .set({ like_count: sql`like_count + 1` })
      .where("id", "=", commentId)
      .executeTakeFirst();
    const rows = await db
      .selectFrom("comments")
      .select(["like_count"])
      .where("id", "=", commentId)
      .execute();
    return NextResponse.json({
      success: true,
      likeCount: rows[0]?.like_count ?? 0,
    });
  } catch (error: any) {
    console.error("POST /api/comments/[id]/like error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
