import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMinioClient, PUBLIC_URL_BASE, BUCKET_NAME } from "@/lib/minio";
import sharp from "sharp";

// GET /api/user/profile-customization - 获取当前用户的主页定制信息
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const users = (await query(
      "SELECT banner, bio, social_links, featured_collections FROM users WHERE id = ?",
      [userId]
    )) as any[];

    if (users.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const user = users[0];

    // 解析 JSON 字段（MySQL JSON 列可能返回字符串）
    let socialLinks = {};
    let featuredCollections: number[] = [];
    try {
      socialLinks = user.social_links
        ? (typeof user.social_links === "string" ? JSON.parse(user.social_links) : user.social_links)
        : {};
    } catch { socialLinks = {}; }
    try {
      const raw = user.featured_collections
        ? (typeof user.featured_collections === "string" ? JSON.parse(user.featured_collections) : user.featured_collections)
        : [];
      featuredCollections = Array.isArray(raw) ? raw : [];
    } catch { featuredCollections = []; }

    return NextResponse.json({
      banner: user.banner || "",
      bio: user.bio || "",
      social_links: socialLinks,
      featured_collections: featuredCollections,
    });
  } catch (error: any) {
    console.error("GET /api/user/profile-customization error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// PATCH /api/user/profile-customization - 更新主页定制信息
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const contentType = request.headers.get("content-type") || "";

    // === Banner 上传（FormData）===
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const bannerFile = formData.get("banner") as File | null;
      if (!bannerFile) {
        return NextResponse.json({ error: "请选择Banner文件" }, { status: 400 });
      }

      // 校验文件类型
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(bannerFile.type)) {
        return NextResponse.json({ error: "仅支持 JPG/PNG/WebP 格式" }, { status: 400 });
      }

      // 限制大小 5MB
      if (bannerFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Banner文件不能超过 5MB" }, { status: 400 });
      }

      // 读取文件缓冲区
      const buffer = Buffer.from(await bannerFile.arrayBuffer());

      // 用 sharp 压缩和调整尺寸
      const processedBuffer = await sharp(buffer)
        .resize(1920, 480, { fit: "cover", position: "center" })
        .jpeg({ quality: 85 })
        .toBuffer();

      // 上传到 MinIO
      const timestamp = Date.now();
      const storageKey = `banners/${userId}_${timestamp}.jpg`;

      const minioClient = getMinioClient();
      await minioClient.putObject(BUCKET_NAME, storageKey, processedBuffer, processedBuffer.length, {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      });

      const bannerUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

      // 更新数据库
      await query("UPDATE users SET banner = ? WHERE id = ?", [bannerUrl, userId]);

      return NextResponse.json({
        message: "Banner已更新",
        banner: bannerUrl,
      });
    }

    // === JSON 更新（bio / social_links / featured_collections）===
    const body = await request.json();
    const { bio, social_links, featured_collections } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (bio !== undefined) {
      if (typeof bio !== "string" || bio.length > 200) {
        return NextResponse.json({ error: "简介最长200个字符" }, { status: 400 });
      }
      updates.push("bio = ?");
      values.push(bio);
    }

    if (social_links !== undefined) {
      if (typeof social_links !== "object" || social_links === null) {
        return NextResponse.json({ error: "社交链接格式错误" }, { status: 400 });
      }
      // 最多5个社交链接
      const keys = Object.keys(social_links);
      if (keys.length > 5) {
        return NextResponse.json({ error: "最多5个社交链接" }, { status: 400 });
      }
      updates.push("social_links = ?");
      values.push(JSON.stringify(social_links));
    }

    if (featured_collections !== undefined) {
      if (!Array.isArray(featured_collections)) {
        return NextResponse.json({ error: "精选合集格式错误" }, { status: 400 });
      }
      if (featured_collections.length > 3) {
        return NextResponse.json({ error: "最多3个精选合集" }, { status: 400 });
      }
      // 验证合集存在且属于当前用户
      if (featured_collections.length > 0) {
        const validCollections = (await query(
          `SELECT id FROM collections WHERE id IN (${featured_collections.map(() => "?").join(",")}) AND user_id = ?`,
          [...featured_collections, userId]
        )) as any[];
        if (validCollections.length !== featured_collections.length) {
          return NextResponse.json({ error: "部分合集不存在或不属于您" }, { status: 400 });
        }
      }
      updates.push("featured_collections = ?");
      values.push(JSON.stringify(featured_collections));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的内容" }, { status: 400 });
    }

    values.push(userId);
    await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);

    return NextResponse.json({ message: "主页定制已保存" });
  } catch (error: any) {
    console.error("PATCH /api/user/profile-customization error:", error);
    return NextResponse.json({ error: error.message || "保存失败" }, { status: 500 });
  }
}