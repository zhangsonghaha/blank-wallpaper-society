import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getObject, objectExists, putBuffer, getPublicUrl } from "@/lib/minio";
import { getResizedKey, RESOLUTION_MAP } from "@/lib/resolutions";
import sharp from "sharp";

// GET /api/images/[id]/download?resolution=1920x1080 - 下载指定分辨率的图片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const resolution = searchParams.get("resolution"); // e.g. "1920x1080"

    const rows = (await query("SELECT * FROM images WHERE id = ?", [
      id,
    ])) as any[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const image = rows[0];

    // 增加下载计数
    await query("UPDATE images SET download_count = download_count + 1 WHERE id = ?", [id]);

    // 记录下载日志（异步不阻塞）
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || request.headers.get("x-real-ip") 
      || "0.0.0.0";
    // IP脱敏
    const maskIp = (ip: string) => {
      if (ip.includes(".")) { const p = ip.split("."); return `${p[0]}.${p[1]}.*.*`; }
      if (ip.includes(":")) { const p = ip.split(":"); return `${p[0]}:${p[1]}:****`; }
      return "*.*.*.*";
    };
    query(
      "INSERT INTO download_logs (image_id, ip_address, resolution) VALUES (?, ?, ?)",
      [id, maskIp(ipAddress), resolution || null]
    ).catch(() => {});

    let buffer: Buffer;
    let mimeType: string;
    let fileName: string;

    const isVideo = image.media_type === "video" || (image.mime_type && image.mime_type.startsWith("video/"));

    if (resolution && !isVideo) {
      // 下载指定分辨率（仅图片支持缩放）
      const resInfo = RESOLUTION_MAP.get(resolution);
      if (!resInfo) {
        return NextResponse.json(
          { error: `不支持的分辨率: ${resolution}` },
          { status: 400 }
        );
      }

      const resizedKey = getResizedKey(
        image.storage_key,
        resInfo.width,
        resInfo.height
      );

      // 检查缓存是否存在
      const exists = await objectExists(resizedKey);
      if (exists) {
        buffer = await getObject(resizedKey);
      } else {
        // 实时生成
        const originalBuffer = await getObject(image.storage_key);
        buffer = await sharp(originalBuffer)
          .resize(resInfo.width, resInfo.height, {
            fit: "cover",
            position: "center",
          })
          .webp({ quality: 90 })
          .toBuffer();

        // 异步缓存（不阻塞响应）
        putBuffer(buffer, resizedKey, "image/webp").catch((err) => {
          console.error("缓存缩放图失败:", err);
        });
      }

      mimeType = "image/webp";
      fileName = `${image.title || "image"}_${resolution}.webp`;
    } else {
      // 下载原文件（视频或无分辨率参数的图片）
      buffer = await getObject(image.storage_key);
      mimeType = image.mime_type || "image/jpeg";
      const ext = mimeType.split("/")[1] || "jpg";
      fileName = `${image.title || "image"}.${ext}`;
    }

    // 返回文件流
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error: any) {
    console.error("下载图片失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}