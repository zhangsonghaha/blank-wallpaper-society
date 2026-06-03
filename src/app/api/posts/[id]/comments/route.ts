import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { sanitizeComment } from "@/lib/sanitize";

// GET /api/posts/[id]/comments - 获取帖子评论列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "无效的帖子ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 获取评论总数
    const countResult = await db
      .selectFrom("comments")
      .select((eb) => [eb.fn.countAll().as("total")])
      .where("post_id", "=", postId)
      .where("parent_id", "is", null)
      .execute();
    const total = Number(countResult[0]?.total ?? 0);

    // 获取顶级评论
    const comments = await db
      .selectFrom("comments as c")
      .leftJoin("users as u", "u.id", "c.user_id")
      .select([
        "c.id", "c.post_id", "c.user_id", "c.content", "c.parent_id",
        "c.image_id", "c.like_count", "c.created_at",
        sql<string>`u.name`.as("user_name"),
        sql<string | null>`u.avatar`.as("user_avatar"),
      ])
      .where("c.post_id", "=", postId)
      .where("c.parent_id", "is", null)
      .orderBy("c.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 获取每条顶级评论的回复
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const replies = await db
          .selectFrom("comments as c")
          .leftJoin("users as u", "u.id", "c.user_id")
          .select([
            "c.id", "c.post_id", "c.user_id", "c.content", "c.parent_id",
            "c.image_id", "c.like_count", "c.created_at",
            sql<string>`u.name`.as("user_name"),
            sql<string | null>`u.avatar`.as("user_avatar"),
          ])
          .where("c.parent_id", "=", comment.id)
          .orderBy("c.created_at", "asc")
          .execute();
        return { ...comment, replies };
      })
    );

    return NextResponse.json({
      data: commentsWithReplies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/posts/[id]/comments error:", error);
    return NextResponse.json({ error: error.message || "获取评论失败" }, { status: 500 });
  }
}

// POST /api/posts/[id]/comments - 发表帖子评论
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
    if (isNaN(postId)) {
      return NextResponse.json({ error: "无效的帖子ID" }, { status: 400 });
    }

    const body = await request.json();
    let { content, parent_id } = body;

    // XSS 净化：过滤评论内容中的危险 HTML
    content = sanitizeComment(content);

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
    }
    if (content.trim().length > 1000) {
      return NextResponse.json({ error: "评论内容不能超过1000字" }, { status: 400 });
    }

    // 验证帖子存在
    const posts = await db
      .selectFrom("posts")
      .select(["id", "user_id"])
      .where("id", "=", postId)
      .execute();
    if (posts.length === 0) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 如果是回复，验证父评论
    if (parent_id) {
      const parents = await db
        .selectFrom("comments")
        .select(["id"])
        .where("id", "=", parent_id)
        .where("post_id", "=", postId)
        .execute();
      if (parents.length === 0) {
        return NextResponse.json({ error: "父评论不存在" }, { status: 404 });
      }
    }

    // 插入评论
    const result = await db
      .insertInto("comments")
      .values({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .executeTakeFirst();

    const insertId = Number(result.insertId);

    // 更新帖子评论计数
    await db
      .updateTable("posts")
      .set({ comments_count: sql`comments_count + 1` })
      .where("id", "=", postId)
      .executeTakeFirst();

    // 获取新评论（含用户信息）
    const newComment = await db
      .selectFrom("comments as c")
      .leftJoin("users as u", "u.id", "c.user_id")
      .select([
        "c.id", "c.post_id", "c.user_id", "c.content", "c.parent_id",
        "c.image_id", "c.like_count", "c.created_at",
        sql<string>`u.name`.as("user_name"),
        sql<string | null>`u.avatar`.as("user_avatar"),
      ])
      .where("c.id", "=", insertId)
      .execute();

    return NextResponse.json({
      data: newComment[0] || { id: insertId },
      message: "评论成功",
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/posts/[id]/comments error:", error);
    return NextResponse.json({ error: error.message || "评论失败" }, { status: 500 });
  }
}
