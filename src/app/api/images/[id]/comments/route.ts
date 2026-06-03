import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { notifyCommentReply } from "@/lib/notification";
import { sanitizeComment } from "@/lib/sanitize";

// GET /api/images/[id]/comments - 获取图片评论列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageIdStr } = await params;
    const id = parseInt(imageIdStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "无效的图片ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const sort = searchParams.get("sort") || "latest"; // latest | hot

    // 获取评论总数
    const countResult = await db
      .selectFrom("comments")
      .where("image_id", "=", id)
      .where("parent_id", "is", null)
      .select((eb) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // 获取顶级评论（parent_id IS NULL）
    let commentsQuery = db
      .selectFrom("comments as c")
      .leftJoin("users as u", "c.user_id", "u.id")
      .where("c.image_id", "=", id)
      .where("c.parent_id", "is", null)
      .selectAll("c")
      .select(["u.name as user_name", "u.avatar as user_avatar"]);

    if (sort === "hot") {
      commentsQuery = commentsQuery
        .orderBy("c.like_count", "desc")
        .orderBy("c.created_at", "desc");
    } else {
      commentsQuery = commentsQuery.orderBy("c.created_at", "desc");
    }

    const comments = await commentsQuery.limit(limit).offset(offset).execute();

    // 获取每条顶级评论的回复
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const replies = await db
          .selectFrom("comments as c")
          .leftJoin("users as u", "c.user_id", "u.id")
          .where("c.parent_id", "=", comment.id)
          .orderBy("c.created_at", "asc")
          .selectAll("c")
          .select(["u.name as user_name", "u.avatar as user_avatar"])
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
    console.error("GET /api/images/[id]/comments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/images/[id]/comments - 发表评论
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id: imageIdStr } = await params;
    const id = parseInt(imageIdStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "无效的图片ID" }, { status: 400 });
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

    // 验证图片存在
    const imageExists = await db
      .selectFrom("images")
      .where("id", "=", id)
      .select("id")
      .executeTakeFirst();
    if (!imageExists) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // 如果是回复，验证父评论存在
    if (parent_id) {
      const parentExists = await db
        .selectFrom("comments")
        .where("id", "=", parent_id)
        .where("image_id", "=", id)
        .select("id")
        .executeTakeFirst();
      if (!parentExists) {
        return NextResponse.json({ error: "父评论不存在" }, { status: 404 });
      }
    }

    const result = await db
      .insertInto("comments")
      .values({
        image_id: id,
        user_id: userId,
        content: content.trim(),
        parent_id: parent_id || null,
      })
      .executeTakeFirst();

    const insertId = Number((result as any).insertId);

    // 获取新评论（含用户信息）
    const newComment = await db
      .selectFrom("comments as c")
      .leftJoin("users as u", "c.user_id", "u.id")
      .where("c.id", "=", insertId)
      .selectAll("c")
      .select(["u.name as user_name", "u.avatar as user_avatar"])
      .executeTakeFirst();

    // 如果是回复别人的评论，给被回复者发通知
    if (parent_id) {
      const parentComment = await db
        .selectFrom("comments")
        .where("id", "=", parent_id)
        .select("user_id")
        .executeTakeFirst();
      if (parentComment && parentComment.user_id !== userId) {
        const imageInfo = await db
          .selectFrom("images")
          .where("id", "=", id)
          .select("title")
          .executeTakeFirst();
        const imageTitle = imageInfo?.title || `图片#${id}`;
        const commenterName = (session.user as any).name || "用户";
        notifyCommentReply(parentComment.user_id, commenterName, imageTitle, id).catch(() => {});
      }
    } else {
      // 如果是顶级评论，给图片作者发通知
      const imageInfo = await db
        .selectFrom("images")
        .where("id", "=", id)
        .select(["uploaded_by", "title"])
        .executeTakeFirst();
      if (imageInfo && imageInfo.uploaded_by && imageInfo.uploaded_by !== userId) {
        const commenterName = (session.user as any).name || "用户";
        const imageTitle = imageInfo?.title || `图片#${id}`;
        notifyCommentReply(imageInfo.uploaded_by, commenterName, imageTitle, id).catch(() => {});
      }
    }

    return NextResponse.json(
      {
        data: newComment || { id: insertId },
        message: "评论成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/images/[id]/comments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
