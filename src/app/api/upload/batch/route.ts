import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/minio";
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
import { sanitizeStrict } from "@/lib/sanitize";
import sharp from "sharp";

const PHASH_THRESHOLD = 5;
const DAILY_UPLOAD_LIMIT = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ADMIN_MAX_FILE_SIZE = 20 * 1024 * 1024;
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;
const BATCH_MAX_FILES = 5;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

/**
 * POST /api/upload/batch - 批量上传图片
 * 支持一次上传最多 5 个文件
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;
    const userName = session.user.name || "";
    const isAdmin = userRole === "admin";

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    if (files.length > BATCH_MAX_FILES) {
      return NextResponse.json({ error: `单次最多上传${BATCH_MAX_FILES}个文件` }, { status: 400 });
    }

    const category = sanitizeStrict((formData.get("category") as string) || "");
    const tags = sanitizeStrict((formData.get("tags") as string) || "");

    // 每日上传限制检查
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

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
        if (!ALLOWED_TYPES.includes(file.type) && !isVideo) {
          errors.push({ index: i, filename: file.name, error: "不支持的文件类型" });
          continue;
        }

        const maxSize = isAdmin ? ADMIN_MAX_FILE_SIZE : MAX_FILE_SIZE;
        if (file.size > maxSize) {
          errors.push({ index: i, filename: file.name, error: `文件大小不能超过${isAdmin ? 20 : 10}MB` });
          continue;
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        let width = 0, height = 0;
        try {
          const metadata = await sharp(buffer).metadata();
          width = metadata.width || 0;
          height = metadata.height || 0;
        } catch {}

        if (!isAdmin && (width < MIN_WIDTH || height < MIN_HEIGHT)) {
          errors.push({ index: i, filename: file.name, error: `图片分辨率过低，最低要求 ${MIN_WIDTH}x${MIN_HEIGHT}` });
          continue;
        }

        // 水印
        let processedBuffer = buffer;
        try {
          const watermarkEnabled = await isWatermarkEnabled();
          if (watermarkEnabled) {
            processedBuffer = Buffer.from(await addWatermark(buffer, { text: await getWatermarkText() }));
          }
        } catch {}

        const { storageKey, url } = await uploadFile(processedBuffer, file.name, file.type);

        let thumbnailUrl = "";
        try {
          const thumbBuffer = await sharp(buffer)
            .resize(400, 400, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          const thumbResult = await uploadFile(thumbBuffer, `thumb_${file.name}.webp`, "image/webp");
          thumbnailUrl = thumbResult.url;
        } catch {}

        // pHash 去重
        let phash: string | null = null;
        let isDuplicate = false;
        try {
          phash = await computePHash(buffer);
          if (phash) {
            const existingImages = await db
              .selectFrom("images")
              .select(["id", "phash"])
              .where("phash", "is not", null)
              .execute();
            for (const existing of existingImages) {
              if (existing.phash && hammingDistance(phash, existing.phash as string) <= PHASH_THRESHOLD) {
                isDuplicate = true;
                break;
              }
            }
          }
        } catch {}

        if (isDuplicate) {
          errors.push({ index: i, filename: file.name, error: "检测到重复图片" });
          continue;
        }

        let dominantColor: string | null = null;
        let colorPalette: string | null = null;
        try {
          const colors = await extractColors(buffer);
          dominantColor = colors.dominant;
          colorPalette = JSON.stringify(colors.palette);
        } catch {}

        let exifData: ExifData | null = null;
        try { exifData = await extractExif(buffer); } catch {}
        const exifJson = exifData && Object.keys(exifData).length > 0 ? JSON.stringify(exifData) : null;

        const title = sanitizeStrict((formData.get(`title_${i}`) as string) || file.name);
        const description = sanitizeStrict((formData.get(`description_${i}`) as string) || "");
        const status = isAdmin ? "approved" : "pending";
        const mediaType = isVideo ? "video" : "image";

        const result = await db
          .insertInto("images")
          .values({
            title,
            description,
            filename: file.name,
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

        // NSFW 检测
        let finalStatus = status;
        try {
          const nsfwResult = await processNSFWDetection(insertId, processedBuffer);
          if (nsfwResult.autoRejected) finalStatus = "rejected";
          else if (nsfwResult.autoApproved) finalStatus = "approved";
          else if (nsfwResult.flagged) finalStatus = "pending";
        } catch {}

        // 异步任务
        addExp(userId, 10).catch(() => {});
        checkAchievements(userId).catch(() => {});
        if (isAdmin) {
          db.selectFrom("images").selectAll().where("id", "=", insertId).execute().then((newImage) => {
            if (newImage.length > 0) {
              indexImage(dbRowToSearchData(newImage[0] as any)).catch(() => {});
            }
          }).catch(() => {});
        }
        if (width > 0 && height > 0) {
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
            .catch(() => {});
        }

        results.push({ id: insertId, title, url, thumbnail_url: thumbnailUrl, status: finalStatus });
      } catch (error: any) {
        errors.push({ index: i, filename: file.name, error: error.message || "上传失败" });
      }
    }

    return NextResponse.json({
      success: results.length,
      failed: errors.length,
      results,
      errors,
    }, { status: results.length > 0 ? 201 : 400 });
  } catch (error: any) {
    console.error("POST /api/upload/batch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
