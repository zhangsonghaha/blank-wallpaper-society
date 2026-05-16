import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

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
    const countResult = await query(
      "SELECT COUNT(*) as total FROM comments WHERE post_id = ? AND parent_id IS NULL",
      [postId]
    ) as any[];
    const total = countResult[0]?.total || 0;

    // 获取顶级评论
    const comments = await query(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ? AND c.parent_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [postId]
    ) as any[];

    // 获取每条顶级评论的回复
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const replies = await query(
          `SELECT c.*, u.name as user_name, u.avatar as user_avatar
           FROM comments c
           LEFT JOIN users u ON c.user_id = u.id
           WHERE c.parent_id = ?
           ORDER BY c.created_at ASC`,
          [comment.id]
        ) as any[];
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
    const { content, parent_id } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
    }
    if (content.trim().length > 1000) {
      return NextResponse.json({ error: "评论内容不能超过1000字" }, { status: 400 });
    }

    // 验证帖子存在
    const posts = await query("SELECT id, user_id FROM posts WHERE id = ?", [postId]) as any[];
    if (posts.length === 0) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    // 如果是回复，验证父评论
    if (parent_id) {
      const parents = await query(
        "SELECT id FROM comments WHERE id = ? AND post_id = ?",
        [parent_id, postId]
      ) as any[];
      if (parents.length === 0) {
        return NextResponse.json({ error: "父评论不存在" }, { status: 404 });
      }
    }

    // 插入评论
    const result = await query(
      "INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)",
      [postId, userId, content.trim(), parent_id || null]
    );

    const insertId = (result as any).insertId;

    // 更新帖子评论计数
    await query(
      "UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?",
      [postId]
    );

    // 获取新评论（含用户信息）
    const newComment = await query(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [insertId]
    ) as any[];

    return NextResponse.json({
      data: newComment[0] || { id: insertId },
      message: "评论成功",
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/posts/[id]/comments error:", error);
    return NextResponse.json({ error: error.message || "评论失败" }, { status: 500 });
  }
}