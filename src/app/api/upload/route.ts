import { NextRequest, NextResponse } from "next/server";
import { uploadFile, BUCKET_NAME, PUBLIC_URL_BASE } from "@/lib/minio";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { extractColors } from "@/lib/color-extract";
import { addWatermark, isWatermarkEnabled, getWatermarkText } from "@/lib/watermark";
import { computePHash, hammingDistance } from "@/lib/phash";
import { extractExif, ExifData } from "@/lib/exif";
import { addExp, checkAchievements } from "@/lib/user-level";
import { indexImage, dbRowToSearchData } from "@/lib/meilisearch";
import { generateAndUploadVariants } from "@/lib/image-variants";
import { processNSFWDetection } from "@/lib/nsfw";
import { sanitizeStrict, sanitizeName } from "@/lib/sanitize";
import { canUpload } from "@/lib/storage-quota";
import sharp from "sharp";
import { sql } from "kysely";
import { clearPattern } from "@/lib/redis";

// pHash 去重阈值：hamming distance <= 5 判定为重复
const PHASH_THRESHOLD = 5;

// 每日上传限制
const DAILY_UPLOAD_LIMIT = 10;
// 非管理员图片文件大小限制 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// 管理员图片文件大小限制 20MB
const ADMIN_MAX_FILE_SIZE = 20 * 1024 * 1024;
// 非管理员视频文件大小限制 50MB
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;
// 管理员视频文件大小限制 100MB
const ADMIN_MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;
// 最低分辨率要求（非管理员）
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;

// 允许的文件类型
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// 允许的视频类型（动态壁纸）
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
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
      let { url, title, description, author, tags, category } = body;

      // XSS 净化：过滤用户输入中的危险 HTML
      title = sanitizeStrict(title);
      description = sanitizeStrict(description);
      author = sanitizeName(author);

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
        const todayCountRow = await db
          .selectFrom("images")
          .select((eb) => [eb.fn.count<number>("id").as("count")])
          .where("author", "=", userName)
          .where("created_at", ">=", todayStart)
          .executeTakeFirst();
        if (Number(todayCountRow?.count ?? 0) >= DAILY_UPLOAD_LIMIT) {
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

      // 计算 pHash 并检测重复
      let phash: string | null = null;
      try {
        phash = await computePHash(imageBuffer);
        if (phash) {
          const existingImages = await db
            .selectFrom("images")
            .select(["id", "title", "url", "thumbnail_url", "phash"])
            .where("phash", "is not", null)
            .execute();

          for (const existing of existingImages) {
            if (existing.phash && hammingDistance(phash, existing.phash as string) <= PHASH_THRESHOLD) {
              return NextResponse.json(
                {
                  error: "检测到重复图片",
                  duplicate: {
                    id: existing.id,
                    title: existing.title,
                    url: existing.url,
                    thumbnail_url: existing.thumbnail_url,
                  },
                },
                { status: 409 }
              );
            }
          }
        }
      } catch {
        // pHash 计算失败不影响主流程
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

      // 提取 EXIF 数据
      let exifData: ExifData | null = null;
      try {
        exifData = await extractExif(imageBuffer);
      } catch {
        // EXIF 提取失败不影响主流程
      }
      const exifJson = exifData && Object.keys(exifData).length > 0 ? JSON.stringify(exifData) : null;

      // 非管理员上传状态为 pending，管理员为 approved
      const status = isAdmin ? "approved" : "pending";

      // 写入数据库
      const result = await db
        .insertInto("images")
        .values({
          title: title || "网络图片",
          description: description || "",
          filename: safeName,
          storage_key: storageKey,
          url: storedUrl,
          thumbnail_url: thumbnailUrl || null,
          width,
          height,
          file_size: imageBuffer.length,
          mime_type: contentTypeHeader,
          author: author || userName,
          tags: tags || "",
          category: category || "",
          status,
          dominant_color: dominantColor,
          color_palette: colorPalette,
          uploaded_by: userId,
          phash,
          exif: exifJson,
        })
        .executeTakeFirst();

      const insertId = Number(result.insertId);

      // 上传成功 → 加经验 + 检查成就（异步不阻塞）
      addExp(userId, 10).catch(() => {});
      checkAchievements(userId).catch(() => {});

      // 管理员上传直接 approved → 自动索引到 Meilisearch
      if (isAdmin) {
        try {
          const newImage = await db.selectFrom("images").selectAll().where("id", "=", insertId).execute();
          if (newImage.length > 0) {
            indexImage(dbRowToSearchData(newImage[0] as any)).catch(() => {});
          }
        } catch {}
      }

      // 异步生成变体（不阻塞上传响应）
      if (width > 0 && height > 0) {
        generateAndUploadVariants(insertId, imageBuffer, width, height)
          .then(async ({ variants, thumbnails }) => {
            await db
              .updateTable("images")
              .set({
                variants: JSON.stringify(variants),
                thumbnails: JSON.stringify(thumbnails),
              })
              .where("id", "=", insertId)
              .executeTakeFirst();
          })
          .catch((err) => {
            console.error(`异步生成变体失败 (imageId=${insertId}):`, err);
          });
      }

      // NSFW 自动审核（同步，决定图片最终状态）
      let finalStatus = status;
      let statusMessage = isAdmin ? "上传成功" : "上传成功，等待审核";
      try {
        const nsfwResult = await processNSFWDetection(insertId, imageBuffer);
        if (nsfwResult.autoRejected) {
          finalStatus = "rejected";
          statusMessage = "上传失败：内容不符合规范，已被自动拒绝";
        } else if (nsfwResult.autoApproved) {
          finalStatus = "approved";
          statusMessage = "上传成功，内容审核通过";
        } else if (nsfwResult.flagged) {
          finalStatus = "pending";
          statusMessage = "上传成功，内容待人工审核";
        }
      } catch {
        // NSFW 检测失败不影响上传
      }

      // 缓存失效
      await clearPattern("images:list:*");

      return NextResponse.json(
        {
          id: insertId,
          title: title || "网络图片",
          url: storedUrl,
          thumbnail_url: thumbnailUrl,
          status: finalStatus,
          message: statusMessage,
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

    // 验证文件类型
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (!ALLOWED_TYPES.includes(file.type) && !isVideo) {
      return NextResponse.json(
        { error: "不支持的文件类型，仅支持: JPEG, PNG, WebP, MP4, WebM" },
        { status: 400 }
      );
    }

    // 验证文件大小（视频文件允许更大）
    const maxSize = isVideo
      ? (isAdmin ? ADMIN_MAX_VIDEO_FILE_SIZE : MAX_VIDEO_FILE_SIZE)
      : (isAdmin ? ADMIN_MAX_FILE_SIZE : MAX_FILE_SIZE);
    const maxSizeMB = isVideo ? (isAdmin ? 100 : 50) : (isAdmin ? 20 : 10);
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件大小不能超过${maxSizeMB}MB` },
        { status: 400 }
      );
    }

    // 非管理员每日上传限制检查
    if (!isAdmin) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCountRow = await db
        .selectFrom("images")
        .select((eb) => [eb.fn.count<number>("id").as("count")])
        .where("uploaded_by", "=", userId)
        .where("created_at", ">=", todayStart)
        .executeTakeFirst();
      if (Number(todayCountRow?.count ?? 0) >= DAILY_UPLOAD_LIMIT) {
        return NextResponse.json(
          { error: `每日上传限制为${DAILY_UPLOAD_LIMIT}张，请明天再试` },
          { status: 429 }
        );
      }
    }

    // 存储配额检查
    const quotaCheck = await canUpload(userId, userRole, file.size);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: `存储空间不足，剩余 ${quotaCheck.quotaInfo.remainingMB}MB，需要 ${Math.round(file.size / (1024 * 1024) * 100) / 100}MB`,
          quota: quotaCheck.quotaInfo,
        },
        { status: 429 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;

    // 获取图片/视频尺寸
    let width = 0;
    let height = 0;
    if (isVideo) {
      // 视频文件：尝试用 ffprobe 获取尺寸，失败时跳过
      try {
        const { execFile } = await import("child_process");
        const probeResult = await new Promise<string>((resolve, reject) => {
          execFile("ffprobe", [
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0",
            "pipe:0"
          ], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout.trim());
          });
          // ffprobe 无法直接从 stdin 读取，需要临时文件
          // 改用从 MinIO URL 探测（上传后）
        }).catch(() => "");
        // 留空，视频尺寸在上传后异步更新
      } catch {
        // ffprobe 不可用，跳过尺寸检测
      }
    } else {
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;
      } catch {
        // 如果 sharp 无法解析，使用默认值
      }
    }

    // 非管理员分辨率验证（仅图片，视频跳过）
    if (!isVideo && !isAdmin && (width < MIN_WIDTH || height < MIN_HEIGHT)) {
      return NextResponse.json(
        { error: `图片分辨率过低，最低要求 ${MIN_WIDTH}x${MIN_HEIGHT}，当前 ${width}x${height}` },
        { status: 400 }
      );
    }

    // 水印处理（仅图片，跳过视频）
    let processedBuffer = buffer;
    if (!isVideo) {
      try {
        const watermarkEnabled = await isWatermarkEnabled();
        if (watermarkEnabled) {
          processedBuffer = Buffer.from(await addWatermark(buffer));
        }
      } catch {
        // 水印处理失败使用原图
      }
    }

    // 上传原图到 MinIO
    const { storageKey, url } = await uploadFile(processedBuffer, filename, file.type);

    // 生成缩略图并上传
    let thumbnailUrl = "";
    if (isVideo) {
      // 视频缩略图：从视频第一帧提取
      try {
        const { execFile } = await import("child_process");
        const fs = await import("fs/promises");
        const os = await import("os");
        const path = await import("path");

        // 保存视频到临时文件（ffmpeg 需要文件路径）
        const tmpVideo = path.join(os.tmpdir(), `video_${Date.now()}_${filename}`);
        const tmpThumb = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);

        await fs.writeFile(tmpVideo, buffer);
        await execFile("ffmpeg", [
          "-i", tmpVideo,
          "-vframes", "1",
          "-vf", "scale=400:-1",
          "-q:v", "2",
          tmpThumb
        ], { timeout: 10000 });

        const thumbJpegBuffer = await fs.readFile(tmpThumb);
        const thumbWebpBuffer = await sharp(thumbJpegBuffer)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        const thumbResult = await uploadFile(
          thumbWebpBuffer,
          `thumb_${filename}.webp`,
          "image/webp"
        );
        thumbnailUrl = thumbResult.url;

        // 清理临时文件
        await fs.unlink(tmpVideo).catch(() => {});
        await fs.unlink(tmpThumb).catch(() => {});
      } catch (thumbErr) {
        console.error("视频缩略图生成失败:", thumbErr);
        // ffmpeg 不可用或失败时，使用占位缩略图
      }
    } else {
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
    }

    // 计算 pHash 并检测重复（仅图片，跳过视频）
    let phash: string | null = null;
    if (!isVideo) {
      try {
        phash = await computePHash(buffer);
        if (phash) {
          const existingImages = await db
            .selectFrom("images")
            .select(["id", "title", "url", "thumbnail_url", "phash"])
            .where("phash", "is not", null)
            .execute();

          for (const existing of existingImages) {
            if (existing.phash && hammingDistance(phash, existing.phash as string) <= PHASH_THRESHOLD) {
              return NextResponse.json(
                {
                  error: "检测到重复图片",
                  duplicate: {
                    id: existing.id,
                    title: existing.title,
                    url: existing.url,
                    thumbnail_url: existing.thumbnail_url,
                  },
                },
                { status: 409 }
              );
            }
          }
        }
      } catch {
        // pHash 计算失败不影响主流程
      }
    }

    // 提取颜色信息（仅图片，跳过视频）
    let dominantColor: string | null = null;
    let colorPalette: string | null = null;
    if (!isVideo) {
      try {
        const colors = await extractColors(buffer);
        dominantColor = colors.dominant;
        colorPalette = JSON.stringify(colors.palette);
      } catch {
        // 颜色提取失败不影响主流程
      }
    }

    // 提取 EXIF 数据（仅图片，跳过视频）
    let exifData: ExifData | null = null;
    if (!isVideo) {
      try {
        exifData = await extractExif(buffer);
      } catch {
        // EXIF 提取失败不影响主流程
      }
    }
    const exifJson = exifData && Object.keys(exifData).length > 0 ? JSON.stringify(exifData) : null;

    // 获取表单其他字段
    const title = sanitizeStrict((formData.get("title") as string) || filename);
    const description = sanitizeStrict((formData.get("description") as string) || "");
    const tags = sanitizeStrict((formData.get("tags") as string) || "");
    const category = (formData.get("category") as string) || "";

    // 非管理员上传状态为 pending，管理员为 approved
    const status = isAdmin ? "approved" : "pending";
    const mediaType = isVideo ? "video" : "image";

    // 写入数据库
    const result = await db
      .insertInto("images")
      .values({
        title,
        description,
        filename,
        storage_key: storageKey,
        url,
        thumbnail_url: thumbnailUrl || null,
        width,
        height,
        file_size: file.size,
        mime_type: file.type,
        author: userName,
        tags,
        category,
        status,
        dominant_color: dominantColor,
        color_palette: colorPalette,
        uploaded_by: userId,
        phash,
        exif: exifJson,
        media_type: mediaType,
      })
      .executeTakeFirst();

    const insertId = Number(result.insertId);

    // 管理员上传直接 approved → 自动索引到 Meilisearch
    if (isAdmin) {
      try {
        const newImage = await db.selectFrom("images").selectAll().where("id", "=", insertId).execute();
        if (newImage.length > 0) {
          indexImage(dbRowToSearchData(newImage[0] as any)).catch(() => {});
        }
      } catch {}
    }

    // 异步生成变体（仅图片，跳过视频）
    if (!isVideo && width > 0 && height > 0) {
      generateAndUploadVariants(insertId, processedBuffer, width, height)
        .then(async ({ variants, thumbnails }) => {
          await db
            .updateTable("images")
            .set({
              variants: JSON.stringify(variants),
              thumbnails: JSON.stringify(thumbnails),
            })
            .where("id", "=", insertId)
            .executeTakeFirst();
        })
        .catch((err) => {
          console.error(`异步生成变体失败 (imageId=${insertId}):`, err);
        });
    }

    // NSFW 自动审核（仅图片，跳过视频）
    let finalStatus = status;
    let statusMessage = isVideo
      ? (isAdmin ? "视频上传成功" : "视频上传成功，等待审核")
      : (isAdmin ? "上传成功" : "上传成功，等待审核");
    if (!isVideo) {
    try {
      const nsfwResult = await processNSFWDetection(insertId, processedBuffer);
      if (nsfwResult.autoRejected) {
        finalStatus = "rejected";
        statusMessage = "上传失败：内容不符合规范，已被自动拒绝";
      } else if (nsfwResult.autoApproved) {
        finalStatus = "approved";
        statusMessage = "上传成功，内容审核通过";
      } else if (nsfwResult.flagged) {
        finalStatus = "pending";
        statusMessage = "上传成功，内容待人工审核";
      }
    } catch {
      // NSFW 检测失败不影响上传
    }
    } // end if (!isVideo)

    // 缓存失效
    await clearPattern("images:list:*");

    return NextResponse.json(
      {
        id: insertId,
        title,
        url,
        thumbnail_url: thumbnailUrl,
        media_type: mediaType,
        status: finalStatus,
        message: statusMessage,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
