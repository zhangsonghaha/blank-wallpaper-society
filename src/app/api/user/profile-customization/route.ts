import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMinioClient, PUBLIC_URL_BASE, BUCKET_NAME } from "@/lib/minio";
import sharp from "sharp";

// GET /api/user/profile-customization - 获取当前用户主页定制信息
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
    // 解析 JSON 字段
    let socialLinks = null;
    let featuredCollections = null;
    try {
      socialLinks = user.social_links ? (typeof user.social_links === "string" ? JSON.parse(user.social_links) : user.social_links) : null;
    } catch { socialLinks = null; }
    try {
      featuredCollections = user.featured_collections ? (typeof user.featured_collections === "string" ? JSON.parse(user.featured_collections) : user.featured_collections) : null;
    } catch { featuredCollections = null; }

    return NextResponse.json({
      banner: user.banner || null,
      bio: user.bio || null,
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

    // === Banner上传（FormData）===
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

      const buffer = Buffer.from(await bannerFile.arrayBuffer());

      // 用 sharp 压缩为 Banner 尺寸
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

    // === JSON 更新 ===
    const body = await request.json();
    const { banner, bio, social_links, featured_collections } = body;

    const updates: string[] = [];
    const params: any[] = [];

    // 验证 banner
    if (banner !== undefined) {
      if (banner && banner.length > 500) {
        return NextResponse.json({ error: "Banner URL最长500字符" }, { status: 400 });
      }
      if (banner && !/^https?:\/\/.+/.test(banner)) {
        return NextResponse.json({ error: "Banner URL格式不正确" }, { status: 400 });
      }
      updates.push("banner = ?");
      params.push(banner || null);
    }

    // 验证 bio
    if (bio !== undefined) {
      if (bio && bio.length > 200) {
        return NextResponse.json({ error: "个人简介最长200字符" }, { status: 400 });
      }
      updates.push("bio = ?");
      params.push(bio || null);
    }

    // 验证 social_links
    if (social_links !== undefined) {
      if (social_links) {
        if (typeof social_links !== "object" || Array.isArray(social_links)) {
          return NextResponse.json({ error: "社交链接格式不正确" }, { status: 400 });
        }
        const keys = Object.keys(social_links);
        if (keys.length > 5) {
          return NextResponse.json({ error: "社交链接最多5个" }, { status: 400 });
        }
        for (const key of keys) {
          if (typeof social_links[key] !== "string") {
            return NextResponse.json({ error: "社交链接值必须为字符串" }, { status: 400 });
          }
          if (social_links[key].length > 200) {
            return NextResponse.json({ error: "每个社交链接最长200字符" }, { status: 400 });
          }
        }
      }
      updates.push("social_links = ?");
      params.push(social_links ? JSON.stringify(social_links) : null);
    }

    // 验证 featured_collections
    if (featured_collections !== undefined) {
      if (featured_collections) {
        if (!Array.isArray(featured_collections)) {
          return NextResponse.json({ error: "精选合集必须为数组" }, { status: 400 });
        }
        if (featured_collections.length > 3) {
          return NextResponse.json({ error: "精选合集最多3个" }, { status: 400 });
        }
        // 验证合集属于当前用户
        if (featured_collections.length > 0) {
          const collectionIds = featured_collections.map((id: any) => Number(id)).filter((id: number) => !isNaN(id));
          if (collectionIds.length !== featured_collections.length) {
            return NextResponse.json({ error: "合集ID格式不正确" }, { status: 400 });
          }
          const ownedCollections = (await query(
            `SELECT id FROM collections WHERE id IN (${collectionIds.map(() => "?").join(",")}) AND user_id = ?`,
            [...collectionIds, userId]
          )) as any[];
          if (ownedCollections.length !== collectionIds.length) {
            return NextResponse.json({ error: "只能选择自己创建的合集" }, { status: 400 });
          }
        }
      }
      updates.push("featured_collections = ?");
      params.push(featured_collections && featured_collections.length > 0 ? JSON.stringify(featured_collections) : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    params.push(userId);
    await query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    return NextResponse.json({ message: "更新成功" });
  } catch (error: any) {
    console.error("PATCH /api/user/profile-customization error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}