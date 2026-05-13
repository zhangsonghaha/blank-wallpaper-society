import { NextRequest, NextResponse } from "next/server";
import { uploadFile, BUCKET_NAME, PUBLIC_URL_BASE } from "@/lib/minio";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { extractColors } from "@/lib/color-extract";
import sharp from "sharp";

// 每日上传限制
const DAILY_UPLOAD_LIMIT = 10;
// 非管理员文件大小限制 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// 管理员文件大小限制 20MB
const ADMIN_MAX_FILE_SIZE = 20 * 1024 * 1024;
// 最低分辨率要求（非管理员）
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;

// 允许的文件类型
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// POST /api/upload - 上传图片到 MinIO 并记录到数据库
export async function POST(request: NextRequest) {
  try {
    // === 用户认证 ===
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userName = session.user.name || "";
    const isAdmin = userRole === "admin";

    const contentType = request.headers.get("content-type") || "";

    // === 网络链接模式 ===
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const { url, title, description, author, tags, category } = body;

      if (!url) {
        return NextResponse.json({ error: "请输入图片链接" }, { status: 400 });
      }

      // 验证 URL 格式
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          return NextResponse.json({ error: "仅支持 HTTP/HTTPS 链接" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "请输入有效的图片链接" }, { status: 400 });
      }

      // 非管理员每日上传限制检查
      if (!isAdmin) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await query(
          "SELECT COUNT(*) as count FROM images WHERE author = ? AND created_at >= ?",
          [userName, todayStart.toISOString().slice(0, 19).replace("T", " ")]
        );
        if ((todayCount as any[])[0]?.count >= DAILY_UPLOAD_LIMIT) {
          return NextResponse.json(
            { error: `每日上传限制为${DAILY_UPLOAD_LIMIT}张，请明天再试` },
            { status: 429 }
          );
        }
      }

      // 获取图片信息
      const imageRes = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!imageRes.ok) {
        return NextResponse.json({ error: "无法访问该链接" }, { status: 400 });
      }

      const contentLength = parseInt(imageRes.headers.get("content-length") || "0");
      const contentTypeHeader = imageRes.headers.get("content-type") || "";

      if (!contentTypeHeader.startsWith("image/")) {
        return NextResponse.json({ error: "链接不是图片格式" }, { status: 400 });
      }

      // 下载图片
      const imageBuffer = await fetch(url).then((r) => r.arrayBuffer()).then((b) => Buffer.from(b));

      // 获取图片尺寸
      let width = 0;
      let height = 0;
      try {
        const metadata = await sharp(imageBuffer).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;
      } catch {
        // 如果 sharp 无法解析，使用默认值
      }

      // 上传到 MinIO
      const timestamp = Date.now();
      const safeName = url.split("/").pop()?.split("?")[0] || `img_${timestamp}`;
      const storageKey = `images/${timestamp}_${safeName}`;

      const minioClient = await import("@/lib/minio").then((m) => m.getMinioClient());
      await minioClient.putObject(BUCKET_NAME, storageKey, imageBuffer, imageBuffer.length, {
        "Content-Type": contentTypeHeader,
      });

      const storedUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

      // 生成缩略图
      let thumbnailUrl = "";
      try {
        const thumbBuffer = await sharp(imageBuffer)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        const thumbResult = await uploadFile(
          thumbBuffer,
          `thumb_${timestamp}.webp`,
          "image/webp"
        );
        thumbnailUrl = thumbResult.url;
      } catch {
        // 缩略图生成失败不影响主流程
      }

      // 提取颜色信息
      let dominantColor: string | null = null;
      let colorPalette: string | null = null;
      try {
        const colors = await extractColors(imageBuffer);
        dominantColor = colors.dominant;
        colorPalette = JSON.stringify(colors.palette);
      } catch {
        // 颜色提取失败不影响主流程
      }

      // 非管理员上传状态为 pending，管理员为 approved
      const status = isAdmin ? "approved" : "pending";

      // 写入数据库
      const result = await query(
        `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category, status, dominant_color, color_palette, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title || "网络图片",
          description || "",
          safeName,
          storageKey,
          storedUrl,
          thumbnailUrl || null,
          width,
          height,
          imageBuffer.length,
          contentTypeHeader,
          author || userName,
          tags || "",
          category || "",
          status,
          dominantColor,
          colorPalette,
          userId,
        ]
      );

      const insertId = (result as any).insertId;

      return NextResponse.json(
        {
          id: insertId,
          title: title || "网络图片",
          url: storedUrl,
          thumbnail_url: thumbnailUrl,
          status,
          message: isAdmin ? "上传成功" : "上传成功，等待审核",
        },
        { status: 201 }
      );
    }

    // === 本地文件上传模式 ===
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    // 验证文件类型（非管理员只允许 jpg/png/webp）
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "不支持的文件类型，仅支持: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    // 验证文件大小
    const maxSize = isAdmin ? ADMIN_MAX_FILE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件大小不能超过${isAdmin ? 20 : 10}MB` },
        { status: 400 }
      );
    }

    // 非管理员每日上传限制检查
    if (!isAdmin) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await query(
        "SELECT COUNT(*) as count FROM images WHERE uploaded_by = ? AND created_at >= ?",
        [userId, todayStart.toISOString().slice(0, 19).replace("T", " ")]
      );
      if ((todayCount as any[])[0]?.count >= DAILY_UPLOAD_LIMIT) {
        return NextResponse.json(
          { error: `每日上传限制为${DAILY_UPLOAD_LIMIT}张，请明天再试` },
          { status: 429 }
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;

    // 获取图片尺寸
    let width = 0;
    let height = 0;
    try {
      const metadata = await sharp(buffer).metadata();
      width = metadata.width || 0;
      height = metadata.height || 0;
    } catch {
      // 如果 sharp 无法解析，使用默认值
    }

    // 非管理员分辨率验证
    if (!isAdmin && (width < MIN_WIDTH || height < MIN_HEIGHT)) {
      return NextResponse.json(
        { error: `图片分辨率过低，最低要求 ${MIN_WIDTH}x${MIN_HEIGHT}，当前 ${width}x${height}` },
        { status: 400 }
      );
    }

    // 上传原图到 MinIO
    const { storageKey, url } = await uploadFile(buffer, filename, file.type);

    // 生成缩略图并上传
    let thumbnailUrl = "";
    try {
      const thumbBuffer = await sharp(buffer)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbResult = await uploadFile(
        thumbBuffer,
        `thumb_${filename}.webp`,
        "image/webp"
      );
      thumbnailUrl = thumbResult.url;
    } catch {
      // 缩略图生成失败不影响主流程
    }

    // 提取颜色信息
    let dominantColor: string | null = null;
    let colorPalette: string | null = null;
    try {
      const colors = await extractColors(buffer);
      dominantColor = colors.dominant;
      colorPalette = JSON.stringify(colors.palette);
    } catch {
      // 颜色提取失败不影响主流程
    }

    // 获取表单其他字段
    const title = (formData.get("title") as string) || filename;
    const description = (formData.get("description") as string) || "";
    const tags = (formData.get("tags") as string) || "";
    const category = (formData.get("category") as string) || "";

    // 非管理员上传状态为 pending，管理员为 approved
    const status = isAdmin ? "approved" : "pending";

    // 写入数据库
    const result = await query(
      `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category, status, dominant_color, color_palette, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        description,
        filename,
        storageKey,
        url,
        thumbnailUrl || null,
        width,
        height,
        file.size,
        file.type,
        userName,
        tags,
        category,
        status,
        dominantColor,
        colorPalette,
        userId,
      ]
    );

    const insertId = (result as any).insertId;

    return NextResponse.json(
      {
        id: insertId,
        title,
        url,
        thumbnail_url: thumbnailUrl,
        status,
        message: isAdmin ? "上传成功" : "上传成功，等待审核",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}