import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFile, BUCKET_NAME, PUBLIC_URL_BASE, getMinioClient } from "@/lib/minio";
import { extractColors } from "@/lib/color-extract";
import { indexImage, dbRowToSearchData } from "@/lib/meilisearch";
import sharp from "sharp";

// POST /api/admin/crawl/import — 确认入库选中的预览项
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: "请提供 session_id" }, { status: 400 });
    }

    // 获取选中的预览项
    const items = await query(
      `SELECT * FROM crawl_preview_items WHERE session_id = ? AND is_selected = 1`,
      [session_id]
    ) as any[];

    if (items.length === 0) {
      return NextResponse.json({ error: "没有选中的图片" }, { status: 400 });
    }

    // 更新会话状态为 importing
    await query(
      `UPDATE crawl_sessions SET status = 'importing' WHERE id = ?`,
      [session_id]
    );

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        const result = await processPreviewItem(item, userId);
        if (result) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error: any) {
        console.error(`导入失败 [${item.title}]:`, error);
        failCount++;
      }
    }

    // 更新会话状态为 completed
    await query(
      `UPDATE crawl_sessions SET status = 'completed', imported_count = ? WHERE id = ?`,
      [successCount, session_id]
    );

    return NextResponse.json({
      success: true,
      message: `入库完成: 成功 ${successCount} 张, 失败 ${failCount} 张`,
      success_count: successCount,
      fail_count: failCount,
    });
  } catch (error: any) {
    console.error("POST /api/admin/crawl/import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 处理单条预览项：下载 → 上传 MinIO → 写入 images 表
async function processPreviewItem(
  item: {
    id: number;
    source_url: string;
    title: string;
    width: number;
    height: number;
    mime_type: string;
    media_type: string;
    source: string;
    tags: string;
    category: string;
    video_url: string | null;
    poster_url: string | null;
  },
  userId: number
): Promise<any | null> {
  const isVideo = item.media_type === "video";
  const downloadUrl = (isVideo && item.video_url) ? item.video_url : item.source_url;

  if (!downloadUrl) return null;

  // 1. 下载图片/视频
  const imageRes = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": isVideo ? "" : new URL(item.source_url).origin + "/",
    },
    signal: AbortSignal.timeout(60000),
  });

  if (!imageRes.ok) {
    console.error(`下载失败: HTTP ${imageRes.status} - ${downloadUrl}`);
    return null;
  }

  const contentType = imageRes.headers.get("content-type") || (isVideo ? "video/mp4" : "image/jpeg");
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // 2. 获取尺寸（视频不处理）
  let width = item.width || 0;
  let height = item.height || 0;
  if (!isVideo) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      width = metadata.width || width;
      height = metadata.height || height;
    } catch { /* ignore */ }
  }

  // 3. 上传 MinIO
  const timestamp = Date.now();
  const safeName = isVideo ? `crawled_${timestamp}.mp4` : `crawled_${timestamp}.jpg`;
  const storageKey = isVideo
    ? `videos/${timestamp}_${safeName}`
    : `images/${timestamp}_${safeName}`;

  const minioClient = getMinioClient();
  await minioClient.putObject(BUCKET_NAME, storageKey, imageBuffer, imageBuffer.length, {
    "Content-Type": contentType,
  });

  const storedUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

  // 4. 生成缩略图
  let thumbnailUrl = "";
  if (isVideo && item.poster_url) {
    try {
      const posterRes = await fetch(item.poster_url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(15000),
      });
      if (posterRes.ok) {
        const posterBuffer = Buffer.from(await posterRes.arrayBuffer());
        const thumbBuffer = await sharp(posterBuffer)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        const thumbResult = await uploadFile(thumbBuffer, `thumb_${timestamp}.webp`, "image/webp");
        thumbnailUrl = thumbResult.url;
      }
    } catch { /* ignore */ }
  } else {
    try {
      const thumbBuffer = await sharp(imageBuffer)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbResult = await uploadFile(thumbBuffer, `thumb_${timestamp}.webp`, "image/webp");
      thumbnailUrl = thumbResult.url;
    } catch { /* ignore */ }
  }

  // 5. 提取颜色（仅静态图片）
  let dominantColor: string | null = null;
  let colorPalette: string | null = null;
  if (!isVideo) {
    try {
      const colors = await extractColors(imageBuffer);
      dominantColor = colors.dominant;
      colorPalette = JSON.stringify(colors.palette);
    } catch { /* ignore */ }
  }

  // 6. 写入 images 表
  const tagsStr = item.tags || "";
  const description = `[crawl] 从 ${item.source} 爬取 | 源地址: ${item.source_url}${isVideo ? " | 动态壁纸" : ""}`;

  const result = await query(
    `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category, status, dominant_color, color_palette, uploaded_by, media_type, video_url, poster_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title || `从${item.source}爬取的${isVideo ? "动态壁纸" : "图片"}`,
      description,
      safeName,
      storageKey,
      isVideo ? (thumbnailUrl || storedUrl) : storedUrl,
      thumbnailUrl || null,
      width,
      height,
      imageBuffer.length,
      contentType,
      `crawler-${item.source}`,
      tagsStr,
      item.category || "",
      "approved",
      dominantColor,
      colorPalette,
      userId,
      isVideo ? "video" : "image",
      isVideo ? storedUrl : null,
      isVideo ? (thumbnailUrl || null) : null,
    ]
  );

  const insertId = (result as any).insertId;

  // 7. 同步搜索索引
  try {
    const insertedRows = await query(`SELECT * FROM images WHERE id = ?`, [insertId]) as any[];
    if (insertedRows.length > 0) {
      indexImage(dbRowToSearchData(insertedRows[0])).catch(() => {});
    }
  } catch { /* ignore */ }

  return {
    id: insertId,
    title: item.title,
    url: isVideo ? (thumbnailUrl || storedUrl) : storedUrl,
    thumbnail_url: thumbnailUrl,
    width,
    height,
  };
}
