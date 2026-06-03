import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
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
    const post = await db
      .selectFrom("posts")
      .select(["id"])
      .where("id", "=", postId)
      .execute();
    if (post.length === 0) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 检查是否已点赞
    const existing = await db
      .selectFrom("post_likes")
      .select(["id"])
      .where("post_id", "=", postId)
      .where("user_id", "=", userId)
      .execute();

    if (existing.length > 0) {
      // 取消点赞
      await db
        .deleteFrom("post_likes")
        .where("post_id", "=", postId)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      await db
        .updateTable("posts")
        .set({ likes_count: sql`GREATEST(likes_count - 1, 0)` })
        .where("id", "=", postId)
        .executeTakeFirst();
      return NextResponse.json({ liked: false, message: "已取消点赞" });
    } else {
      // 点赞
      await db
        .insertInto("post_likes")
        .values({ post_id: postId, user_id: userId })
        .executeTakeFirst();
      await db
        .updateTable("posts")
        .set({ likes_count: sql`likes_count + 1` })
        .where("id", "=", postId)
        .executeTakeFirst();
      return NextResponse.json({ liked: true, message: "点赞成功" });
    }

  } catch (error: any) {
    console.error("POST /api/posts/[id]/like error:", error);
    return NextResponse.json({ error: error.message || "操作失败" }, { status: 500 });
  }
}
