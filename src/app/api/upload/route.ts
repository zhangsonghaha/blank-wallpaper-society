import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/minio";
import { query } from "@/lib/db";
import sharp from "sharp";

// POST /api/upload - 上传图片到 MinIO 并记录到数据库
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "不支持的文件类型，支持: JPEG, PNG, WebP, GIF, AVIF" },
        { status: 400 }
      );
    }

    // 验证文件大小 (最大 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "文件大小不能超过 20MB" },
        { status: 400 }
      );
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

    // 获取表单其他字段
    const title = (formData.get("title") as string) || filename;
    const description = (formData.get("description") as string) || "";
    const author = (formData.get("author") as string) || "";
    const tags = (formData.get("tags") as string) || "";
    const category = (formData.get("category") as string) || "";

    // 写入数据库
    const result = await query(
      `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        author,
        tags,
        category,
      ]
    );

    const insertId = (result as any).insertId;

    return NextResponse.json(
      {
        id: insertId,
        title,
        url,
        thumbnail_url: thumbnailUrl,
        message: "上传成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}