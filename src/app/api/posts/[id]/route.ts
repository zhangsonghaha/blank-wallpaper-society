import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
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
    const existing = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .execute();
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
      visibility = (formData.get("visibility") as string) || existing[0].visibility || "public";
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
      visibility = body.visibility || existing[0].visibility || "public";
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

    // 删除旧附件记录
    await db.deleteFrom("post_attachments").where("post_id", "=", postId).executeTakeFirst();
    // 删除旧链接预览
    await db.deleteFrom("post_link_previews").where("post_id", "=", postId).executeTakeFirst();

    // 插入新附件
    for (const att of newAttachments) {
      await db
        .insertInto("post_attachments")
        .values({
          post_id: postId,
          type: att.type as "image" | "video",
          url: att.url,
          thumbnail_url: att.thumbnail_url || null,
          width: att.width || 0,
          height: att.height || 0,
          sort_order: att.sort_order || 0,
        })
        .executeTakeFirst();
    }

    // 插入新链接预览
    if (linkUrl) {
      await db
        .insertInto("post_link_previews")
        .values({
          post_id: postId,
          url: linkUrl,
          title: linkTitle,
          description: linkDescription,
          image_url: linkImageUrl,
          site_name: linkSiteName,
        })
        .executeTakeFirst();
    }

    // 更新帖子
    await db
      .updateTable("posts")
      .set({
        content: content.trim(),
        visibility: visibility as "public" | "followers" | "private",
        attachments_count: newAttachments.length,
      })
      .where("id", "=", postId)
      .executeTakeFirst();

    // 返回更新后的数据
    const updatedPost = await db
      .selectFrom("posts as p")
      .leftJoin("users as u", "u.id", "p.user_id")
      .select([
        "p.id", "p.user_id", "p.content", "p.visibility", "p.is_pinned",
        "p.likes_count", "p.comments_count", "p.attachments_count",
        "p.created_at", "p.updated_at",
        sql<string>`u.name`.as("author_name"),
        sql<string | null>`u.avatar`.as("author_avatar"),
      ])
      .where("p.id", "=", postId)
      .execute();

    const postAttachments = await db
      .selectFrom("post_attachments")
      .selectAll()
      .where("post_id", "=", postId)
      .orderBy("sort_order")
      .execute();

    const postLinks = await db
      .selectFrom("post_link_previews")
      .selectAll()
      .where("post_id", "=", postId)
      .execute();

    const likeStatus = userId
      ? await db
          .selectFrom("post_likes")
          .select(["id"])
          .where("post_id", "=", postId)
          .where("user_id", "=", userId)
          .execute()
      : [];

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

    const existing = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .execute();
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
    await db.deleteFrom("posts").where("id", "=", postId).executeTakeFirst();

    return NextResponse.json({ message: "删除成功" });

  } catch (error: any) {
    console.error("DELETE /api/posts/[id] error:", error);
    return NextResponse.json({ error: error.message || "删除失败" }, { status: 500 });
  }
}
