import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { uploadFile } from "@/lib/minio";
import { sanitizeComment, sanitizeStrict } from "@/lib/sanitize";
import { getCache, setCache, clearPattern, CacheKeys, CacheTTL } from "@/lib/redis";

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
    const result = await db
      .insertInto("posts")
      .values({
        user_id: userId,
        content: content.trim(),
        visibility: visibility as "public" | "followers" | "private",
        attachments_count: attachments.length,
      })
      .executeTakeFirst();

    const postId = Number(result.insertId);

    // 插入附件
    for (const att of attachments) {
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

    // 插入链接预览
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

    // 查询完整帖子数据返回
    const newPost = await db
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

    // 缓存失效
    await clearPattern("posts:list:*");

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

    // 缓存检查：仅匿名用户的公开列表请求
    const isAnonymousList = !userId && !userIdFilter && !postId;
    const cacheKey = isAnonymousList ? CacheKeys.POSTS_LIST(page) : null;
    if (cacheKey) {
      const cached = await getCache<any>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    // 获取单个帖子
    if (postId) {
      const posts = await db
        .selectFrom("posts as p")
        .leftJoin("users as u", "u.id", "p.user_id")
        .select([
          "p.id", "p.user_id", "p.content", "p.visibility", "p.is_pinned",
          "p.likes_count", "p.comments_count", "p.attachments_count",
          "p.created_at", "p.updated_at",
          sql<string>`u.name`.as("author_name"),
          sql<string | null>`u.avatar`.as("author_avatar"),
        ])
        .where("p.id", "=", parseInt(postId))
        .execute();

      if (posts.length === 0) {
        return NextResponse.json({ error: "帖子不存在" }, { status: 404 });
      }

      const post = posts[0] as any;
      const attachments = await db
        .selectFrom("post_attachments")
        .selectAll()
        .where("post_id", "=", post.id)
        .orderBy("sort_order")
        .execute();
      const links = await db
        .selectFrom("post_link_previews")
        .selectAll()
        .where("post_id", "=", post.id)
        .execute();
      const likeStatus = userId
        ? await db
            .selectFrom("post_likes")
            .select(["id"])
            .where("post_id", "=", post.id)
            .where("user_id", "=", userId)
            .execute()
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

    // 构建查询 — count query
    let countQuery = db
      .selectFrom("posts as p")
      .select((eb) => [eb.fn.countAll().as("total")]);

    // 构建查询 — list query
    let listQuery = db
      .selectFrom("posts as p")
      .leftJoin("users as u", "u.id", "p.user_id")
      .select([
        "p.id", "p.user_id", "p.content", "p.visibility", "p.is_pinned",
        "p.likes_count", "p.comments_count", "p.attachments_count",
        "p.created_at", "p.updated_at",
        sql<string>`u.name`.as("author_name"),
        sql<string | null>`u.avatar`.as("author_avatar"),
      ]);

    if (userIdFilter) {
      countQuery = countQuery.where("p.user_id", "=", parseInt(userIdFilter));
      listQuery = listQuery.where("p.user_id", "=", parseInt(userIdFilter));
    } else {
      // 非指定用户的查询：只看公开帖子，或自己的帖子
      if (userId) {
        countQuery = countQuery.where((eb) =>
          eb.or([
            eb("p.visibility", "=", "public"),
            eb("p.user_id", "=", userId),
          ])
        );
        listQuery = listQuery.where((eb) =>
          eb.or([
            eb("p.visibility", "=", "public"),
            eb("p.user_id", "=", userId),
          ])
        );
      } else {
        countQuery = countQuery.where("p.visibility", "=", "public");
        listQuery = listQuery.where("p.visibility", "=", "public");
      }
    }

    // 计数
    const countRows = await countQuery.execute();
    const total = Number(countRows[0]?.total ?? 0);

    // 查询帖子列表
    const posts = await listQuery
      .orderBy("p.is_pinned", "desc")
      .orderBy("p.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 批量获取附件、链接、点赞状态
    if (posts.length > 0) {
      const postIds = posts.map((p: any) => p.id);

      const allAttachments = await db
        .selectFrom("post_attachments")
        .selectAll()
        .where("post_id", "in", postIds)
        .orderBy("sort_order")
        .execute();

      const allLinks = await db
        .selectFrom("post_link_previews")
        .selectAll()
        .where("post_id", "in", postIds)
        .execute();

      let likedPostIds = new Set<number>();
      if (userId) {
        const likes = await db
          .selectFrom("post_likes")
          .select(["post_id"])
          .where("user_id", "=", userId)
          .where("post_id", "in", postIds)
          .execute();
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

    const responseData = {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
    if (cacheKey) {
      setCache(cacheKey, responseData, CacheTTL.POSTS_LIST).catch(() => {});
    }
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}
