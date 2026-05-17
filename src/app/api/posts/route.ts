import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/minio";
import { sanitizeComment, sanitizeStrict } from "@/lib/sanitize";

// POST /api/posts - 创建动态
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const contentType = request.headers.get("content-type") || "";

    let content: string;
    let visibility: string;
    let linkUrl: string | null = null;
    let linkTitle: string | null = null;
    let linkDescription: string | null = null;
    let linkImageUrl: string | null = null;
    let linkSiteName: string | null = null;
    let attachments: { type: string; url: string; thumbnail_url?: string; width?: number; height?: number; sort_order?: number }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      content = (formData.get("content") as string) || "";
      visibility = (formData.get("visibility") as string) || "public";
      linkUrl = (formData.get("link_url") as string) || null;
      linkTitle = (formData.get("link_title") as string) || null;
      linkDescription = (formData.get("link_description") as string) || null;
      linkImageUrl = (formData.get("link_image_url") as string) || null;
      linkSiteName = (formData.get("link_site_name") as string) || null;

      // 处理上传的文件（图片/视频）
      const files = formData.getAll("files") as File[];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const buffer = Buffer.from(await file.arrayBuffer());
        const isVideo = file.type.startsWith("video/");
        const mimeType = file.type || (isVideo ? "video/mp4" : "image/jpeg");
        const ext = isVideo ? "mp4" : file.name.split(".").pop() || "jpg";
        const filename = `post_${Date.now()}_${i}.${ext}`;

        const { url } = await uploadFile(buffer, filename, mimeType);
        attachments.push({
          type: isVideo ? "video" : "image",
          url,
          sort_order: i,
        });
      }
    } else {
      // JSON 模式
      const body = await request.json();
      content = body.content || "";
      visibility = body.visibility || "public";
      linkUrl = body.link_url || null;
      linkTitle = body.link_title || null;
      linkDescription = body.link_description || null;
      linkImageUrl = body.link_image_url || null;
      linkSiteName = body.link_site_name || null;
      attachments = body.attachments || [];
    }

    if (!content.trim() && attachments.length === 0 && !linkUrl) {
      return NextResponse.json({ error: "动态内容不能为空" }, { status: 400 });
    }

    // XSS 净化：过滤动态内容和链接预览中的危险 HTML
    content = sanitizeComment(content);
    if (linkTitle) linkTitle = sanitizeStrict(linkTitle);
    if (linkDescription) linkDescription = sanitizeStrict(linkDescription);
    if (linkSiteName) linkSiteName = sanitizeStrict(linkSiteName);

    if (content.length > 2000) {
      return NextResponse.json({ error: "动态内容不能超过2000字" }, { status: 400 });
    }

    if (!["public", "followers", "private"].includes(visibility)) {
      visibility = "public";
    }

    // 插入帖子
    const result = await query(
      `INSERT INTO posts (user_id, content, visibility, attachments_count) VALUES (?, ?, ?, ?)`,
      [userId, content.trim(), visibility, attachments.length]
    );

    const postId = (result as any).insertId;

    // 插入附件
    for (const att of attachments) {
      await query(
        `INSERT INTO post_attachments (post_id, type, url, thumbnail_url, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [postId, att.type, att.url, att.thumbnail_url || null, att.width || 0, att.height || 0, att.sort_order || 0]
      );
    }

    // 插入链接预览
    if (linkUrl) {
      await query(
        `INSERT INTO post_link_previews (post_id, url, title, description, image_url, site_name) VALUES (?, ?, ?, ?, ?, ?)`,
        [postId, linkUrl, linkTitle, linkDescription, linkImageUrl, linkSiteName]
      );
    }

    // 查询完整帖子数据返回
    const newPost = await query(
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

    return NextResponse.json({
      message: "发布成功",
      post: {
        ...(newPost[0] || {}),
        attachments: postAttachments,
        link_previews: postLinks,
        is_liked: false,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ error: error.message || "发布失败" }, { status: 500 });
  }
}

// GET /api/posts - 获取动态列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const rawUserId = session?.user ? (session.user as any).id : null;
    const userId = rawUserId ? Number(rawUserId) : null;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const userIdFilter = searchParams.get("user_id");
    const postId = searchParams.get("id");

    // 获取单个帖子
    if (postId) {
      const posts = await query(
        `SELECT p.*, u.name as author_name, u.avatar as author_avatar
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         WHERE p.id = ?`,
        [parseInt(postId)]
      ) as any[];

      if (posts.length === 0) {
        return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
      }

      const post = posts[0];
      const attachments = await query(
        `SELECT * FROM post_attachments WHERE post_id = ? ORDER BY sort_order`,
        [post.id]
      ) as any[];
      const links = await query(
        `SELECT * FROM post_link_previews WHERE post_id = ?`,
        [post.id]
      ) as any[];
      const likeStatus = userId
        ? await query(`SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`, [post.id, userId]) as any[]
        : [];

      return NextResponse.json({
        post: {
          ...post,
          attachments,
          link_previews: links,
          is_liked: likeStatus.length > 0,
        },
      });
    }

    // 构建查询
    let whereClause = "WHERE 1=1";
    const queryParams: any[] = [];

    if (userIdFilter) {
      whereClause += " AND p.user_id = ?";
      queryParams.push(parseInt(userIdFilter));
    } else {
      // 非指定用户的查询：只看公开帖子，或自己的帖子
      if (userId) {
        whereClause += " AND (p.visibility = 'public' OR p.user_id = ?)";
        queryParams.push(userId);
      } else {
        whereClause += " AND p.visibility = 'public'";
      }
    }

    // 计数 - 使用与列表查询相同的参数
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM posts p ${whereClause}`,
      queryParams
    ) as any[];
    const total = countRows[0]?.total || 0;

    // 查询帖子列表 - 复制参数数组，追加 limit 和 offset
    const listParams = [...queryParams];
    const posts = await query(
      `SELECT p.*, u.name as author_name, u.avatar as author_avatar
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       ${whereClause}
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      listParams
    ) as any[];

    // 批量获取附件、链接、点赞状态
    if (posts.length > 0) {
      const postIds = posts.map((p: any) => p.id);
      const placeholders = postIds.map(() => "?").join(",");

      const allAttachments = await query(
        `SELECT * FROM post_attachments WHERE post_id IN (${placeholders}) ORDER BY sort_order`,
        postIds
      ) as any[];

      const allLinks = await query(
        `SELECT * FROM post_link_previews WHERE post_id IN (${placeholders})`,
        postIds
      ) as any[];

      let likedPostIds = new Set<number>();
      if (userId) {
        const likes = await query(
          `SELECT post_id FROM post_likes WHERE user_id = ? AND post_id IN (${placeholders})`,
          [userId, ...postIds]
        ) as any[];
        likedPostIds = new Set(likes.map((l: any) => l.post_id));
      }

      // 组装
      const attachmentMap = new Map<number, any[]>();
      allAttachments.forEach((a: any) => {
        if (!attachmentMap.has(a.post_id)) attachmentMap.set(a.post_id, []);
        attachmentMap.get(a.post_id)!.push(a);
      });

      const linkMap = new Map<number, any[]>();
      allLinks.forEach((l: any) => {
        if (!linkMap.has(l.post_id)) linkMap.set(l.post_id, []);
        linkMap.get(l.post_id)!.push(l);
      });

      posts.forEach((post: any) => {
        post.attachments = attachmentMap.get(post.id) || [];
        post.link_previews = linkMap.get(post.id) || [];
        post.is_liked = likedPostIds.has(post.id);
      });
    }

    return NextResponse.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error: any) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}