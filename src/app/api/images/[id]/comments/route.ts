import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

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

    // 获取评论总数
    const countResult = (await query(
      "SELECT COUNT(*) as total FROM comments WHERE image_id = ? AND parent_id IS NULL",
      [id]
    )) as any[];
    const total = countResult[0]?.total || 0;

    // 获取顶级评论（parent_id IS NULL）
    const comments = (await query(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.image_id = ? AND c.parent_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, String(limit), String(offset)]
    )) as any[];

    // 获取每条顶级评论的回复
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const replies = (await query(
          `SELECT c.*, u.name as user_name, u.avatar as user_avatar
           FROM comments c
           LEFT JOIN users u ON c.user_id = u.id
           WHERE c.parent_id = ?
           ORDER BY c.created_at ASC`,
          [comment.id]
        )) as any[];
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
    const { content, parent_id } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
    }

    if (content.trim().length > 1000) {
      return NextResponse.json({ error: "评论内容不能超过1000字" }, { status: 400 });
    }

    // 验证图片存在
    const images = (await query("SELECT id FROM images WHERE id = ?", [id])) as any[];
    if (images.length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // 如果是回复，验证父评论存在
    if (parent_id) {
      const parents = (await query(
        "SELECT id FROM comments WHERE id = ? AND image_id = ?",
        [parent_id, id]
      )) as any[];
      if (parents.length === 0) {
        return NextResponse.json({ error: "父评论不存在" }, { status: 404 });
      }
    }

    const result = await query(
      "INSERT INTO comments (image_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)",
      [id, userId, content.trim(), parent_id || null]
    );

    const insertId = (result as any).insertId;

    // 获取新评论（含用户信息）
    const newComment = (await query(
      `SELECT c.*, u.name as user_name, u.avatar as user_avatar
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [insertId]
    )) as any[];

    // 如果是回复别人的评论，给被回复者发通知
    if (parent_id) {
      const parentComment = (await query(
        "SELECT user_id FROM comments WHERE id = ?",
        [parent_id]
      )) as any[];
      if (parentComment.length > 0 && parentComment[0].user_id !== userId) {
        await query(
          `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
           VALUES (?, 'comment', ?, ?, ?, 'image')`,
          [
            parentComment[0].user_id,
            "收到新回复",
            `${session.user.name} 回复了你的评论`,
            content.trim().substring(0, 100),
            id,
          ]
        );
      }
    } else {
      // 如果是顶级评论，给图片作者发通知
      const imageOwner = (await query(
        "SELECT author FROM images WHERE id = ?",
        [id]
      )) as any[];
      if (imageOwner.length > 0) {
        const ownerUser = (await query(
          "SELECT id FROM users WHERE name = ? OR email = ?",
          [imageOwner[0].author, imageOwner[0].author]
        )) as any[];
        if (ownerUser.length > 0 && ownerUser[0].id !== userId) {
          await query(
            `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
             VALUES (?, 'comment', ?, ?, ?, 'image')`,
            [
              ownerUser[0].id,
              "收到新评论",
              `${session.user.name} 评论了你的图片`,
              content.trim().substring(0, 100),
              id,
            ]
          );
        }
      }
    }

    return NextResponse.json(
      {
        data: newComment[0] || { id: insertId },
        message: "评论成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/images/[id]/comments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}