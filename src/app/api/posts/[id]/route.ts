import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/minio";

// PUT /api/posts/[id] - 编辑动态
export async function PUT(
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

    // 验证帖子归属
    const existing = await query("SELECT * FROM posts WHERE id = ?", [postId]) as any[];
    if (existing.length === 0) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (existing[0].user_id !== userId) {
      const isAdmin = (session.user as any).role === "admin";
      if (!isAdmin) {
        return NextResponse.json({ error: "只能编辑自己的动态" }, { status: 403 });
      }
    }

    const contentType = request.headers.get("content-type") || "";
    let content: string;
    let visibility: string;
    let linkUrl: string | null = null;
    let linkTitle: string | null = null;
    let linkDescription: string | null = null;
    let linkImageUrl: string | null = null;
    let linkSiteName: string | null = null;
    let newAttachments: { type: string; url: string; thumbnail_url?: string; width?: number; height?: number; sort_order?: number }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      content = (formData.get("content") as string) || "";
      visibility = (formData.get("visibility") as string) || existing[0].visibility;
      linkUrl = (formData.get("link_url") as string) || null;
      linkTitle = (formData.get("link_title") as string) || null;
      linkDescription = (formData.get("link_description") as string) || null;
      linkImageUrl = (formData.get("link_image_url") as string) || null;
      linkSiteName = (formData.get("link_site_name") as string) || null;

      const files = formData.getAll("files") as File[];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = Buffer.from(await file.arrayBuffer());
        const isVideo = file.type.startsWith("video/");
        const mimeType = file.type || (isVideo ? "video/mp4" : "image/jpeg");
        const ext = isVideo ? "mp4" : file.name.split(".").pop() || "jpg";
        const filename = `post_${Date.now()}_${i}.${ext}`;
        const { url } = await uploadFile(buffer, filename, mimeType);
        newAttachments.push({ type: isVideo ? "video" : "image", url, sort_order: i });
      }
    } else {
      const body = await request.json();
      content = body.content || existing[0].content;
      visibility = body.visibility || existing[0].visibility;
      linkUrl = body.link_url || null;
      linkTitle = body.link_title || null;
      linkDescription = body.link_description || null;
      linkImageUrl = body.link_image_url || null;
      linkSiteName = body.link_site_name || null;
      newAttachments = body.attachments || [];
    }

    if (!content.trim() && newAttachments.length === 0 && !linkUrl) {
      return NextResponse.json({ error: "动态内容不能为空" }, { status: 400 });
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: "动态内容不能超过2000字" }, { status: 400 });
    }

    // 计算总附件数（删除旧附件 + 新附件）
    // 删除旧附件记录
    await query("DELETE FROM post_attachments WHERE post_id = ?", [postId]);
    // 删除旧链接预览
    await query("DELETE FROM post_link_previews WHERE post_id = ?", [postId]);

    // 插入新附件
    for (const att of newAttachments) {
      await query(
        `INSERT INTO post_attachments (post_id, type, url, thumbnail_url, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [postId, att.type, att.url, att.thumbnail_url || null, att.width || 0, att.height || 0, att.sort_order || 0]
      );
    }

    // 插入新链接预览
    if (linkUrl) {
      await query(
        `INSERT INTO post_link_previews (post_id, url, title, description, image_url, site_name) VALUES (?, ?, ?, ?, ?, ?)`,
        [postId, linkUrl, linkTitle, linkDescription, linkImageUrl, linkSiteName]
      );
    }

    // 更新帖子
    await query(
      `UPDATE posts SET content = ?, visibility = ?, attachments_count = ? WHERE id = ?`,
      [content.trim(), visibility, newAttachments.length, postId]
    );

    // 返回更新后的数据
    const updatedPost = await query(
      `SELECT p.*, u.name as author_name, u.avatar as author_avatar
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [postId]
    ) as any[];

    const postAttachments = await query(
      `SELECT * FROM post_attachments WHERE post_id = ? ORDER BY sort_order`,
      [postId]
    ) as any[];

    const postLinks = await query(
      `SELECT * FROM post_link_previews WHERE post_id = ?`,
      [postId]
    ) as any[];

    const likeStatus = userId ? await query(
      `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    ) as any[] : [];

    return NextResponse.json({
      message: "更新成功",
      post: {
        ...(updatedPost[0] || {}),
        attachments: postAttachments,
        link_previews: postLinks,
        is_liked: likeStatus.length > 0,
      },
    });

  } catch (error: any) {
    console.error("PUT /api/posts/[id] error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}

// DELETE /api/posts/[id] - 删除动态
export async function DELETE(
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

    const existing = await query("SELECT * FROM posts WHERE id = ?", [postId]) as any[];
    if (existing.length === 0) {
      return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
    }

    if (existing[0].user_id !== userId) {
      const isAdmin = (session.user as any).role === "admin";
      if (!isAdmin) {
        return NextResponse.json({ error: "只能删除自己的动态" }, { status: 403 });
      }
    }

    // 删除帖子（关联的附件、链接、点赞会通过 CASCADE 自动删除）
    await query("DELETE FROM posts WHERE id = ?", [postId]);

    return NextResponse.json({ message: "删除成功" });

  } catch (error: any) {
    console.error("DELETE /api/posts/[id] error:", error);
    return NextResponse.json({ error: error.message || "删除失败" }, { status: 500 });
  }
}