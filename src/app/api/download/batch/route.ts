import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getObject, objectExists, putBuffer } from "@/lib/minio";
import { getResizedKey, RESOLUTION_MAP } from "@/lib/resolutions";
import sharp from "sharp";
import { Readable } from "stream";

// archiver 的 ESM 兼容问题 - 使用动态导入
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver");

const MAX_BATCH_SIZE = 20;

// POST /api/download/batch - 批量下载图片为zip
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageIds, resolution } = body as {
      imageIds: number[];
      resolution?: string;
    };

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json(
        { error: "请提供要下载的图片ID列表" },
        { status: 400 }
      );
    }

    if (imageIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `单次最多下载${MAX_BATCH_SIZE}张图片` },
        { status: 400 }
      );
    }

    // 验证分辨率
    if (resolution && !RESOLUTION_MAP.has(resolution)) {
      return NextResponse.json(
        { error: `不支持的分辨率: ${resolution}` },
        { status: 400 }
      );
    }

    // 查询图片信息
    const placeholders = imageIds.map(() => "?").join(",");
    const rows = (await query(
      `SELECT * FROM images WHERE id IN (${placeholders})`,
      imageIds
    )) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "未找到指定图片" }, { status: 404 });
    }

    // 增加下载计数
    await query(
      `UPDATE images SET download_count = download_count + 1 WHERE id IN (${placeholders})`,
      imageIds
    );

    // 创建zip流
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
    });

    // 逐个添加图片到zip
    for (const image of rows) {
      try {
        let buffer: Buffer;
        let ext: string;

        const isVideo = image.media_type === "video" || (image.mime_type && image.mime_type.startsWith("video/"));

        if (resolution && !isVideo) {
          const resInfo = RESOLUTION_MAP.get(resolution)!;
          const resizedKey = getResizedKey(
            image.storage_key,
            resInfo.width,
            resInfo.height
          );

          const exists = await objectExists(resizedKey);
          if (exists) {
            buffer = await getObject(resizedKey);
          } else {
            const originalBuffer = await getObject(image.storage_key);
            buffer = await sharp(originalBuffer)
              .resize(resInfo.width, resInfo.height, {
                fit: "cover",
                position: "center",
              })
              .webp({ quality: 90 })
              .toBuffer();

            // 异步缓存
            putBuffer(buffer, resizedKey, "image/webp").catch(() => {});
          }
          ext = "webp";
        } else {
          buffer = await getObject(image.storage_key);
          ext = (image.mime_type || "image/jpeg").split("/")[1] || "jpg";
        }

        const safeTitle = (image.title || "image").replace(
          /[<>:"/\\|?*]/g,
          "_"
        );
        archive.append(buffer, { name: `${safeTitle}.${ext}` });
      } catch (err) {
        console.error(`批量下载：跳过图片 ${image.id}:`, err);
      }
    }

    await archive.finalize();
    const zipBuffer = await archivePromise;

    const resSuffix = resolution ? `_${resolution}` : "";
    const zipFileName = `wallpapers${resSuffix}_${Date.now()}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("批量下载失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}