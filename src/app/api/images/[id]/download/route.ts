import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getObject, objectExists, putBuffer, getPublicUrl } from "@/lib/minio";
import { getResizedKey, RESOLUTION_MAP } from "@/lib/resolutions";
import { addExp, checkAchievements } from "@/lib/user-level";
import { findBestVariantForResolution, VariantInfo } from "@/lib/image-variants";
import { isWatermarkEnabled, addWatermark } from "@/lib/watermark";
import { auth } from "@/lib/auth";
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

    // === 付费壁纸权限检查 ===
    const paidRows = (await query(
      "SELECT price, is_paid FROM paid_wallpapers WHERE image_id = ? AND is_paid = 1",
      [id]
    )) as any[];

    if (paidRows.length > 0) {
      // 这是付费壁纸，检查用户是否已购买或是否为作者
      const session = await auth();
      const userId = (session?.user as any)?.id;

      // 作者可免费下载自己的付费壁纸
      if (userId && userId === image.uploaded_by) {
        // 作者本人，允许下载
      } else if (userId) {
        // 检查是否有已支付的订单
        const orderRows = (await query(
          "SELECT id FROM orders WHERE user_id = ? AND type = 'paid_wallpaper' AND related_id = ? AND payment_status = 'paid'",
          [userId, id]
        )) as any[];
        if (orderRows.length === 0) {
          // 未购买，返回付费信息
          return NextResponse.json(
            {
              error: "该壁纸为付费内容",
              is_paid_wallpaper: true,
              price: parseFloat(paidRows[0].price),
              image_id: parseInt(id),
            },
            { status: 402 }
          );
        }
      } else {
        // 未登录用户，返回付费信息
        return NextResponse.json(
          {
            error: "该壁纸为付费内容，请先登录",
            is_paid_wallpaper: true,
            price: parseFloat(paidRows[0].price),
            image_id: parseInt(id),
          },
          { status: 402 }
        );
      }
    }

    // 增加下载计数
    await query("UPDATE images SET download_count = download_count + 1 WHERE id = ?", [id]);

    // 下载成功 → 图片作者 +2 exp + 检查成就（异步不阻塞）
    if (image.uploaded_by) {
      addExp(image.uploaded_by, 2).catch(() => {});
      checkAchievements(image.uploaded_by).catch(() => {});
    }

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

    try {
      if (resolution && !isVideo) {
        // 下载指定分辨率（仅图片支持缩放）
        const resInfo = RESOLUTION_MAP.get(resolution);
        if (!resInfo) {
          return NextResponse.json(
            { error: `不支持的分辨率: ${resolution}` },
            { status: 400 }
          );
        }

        // 优先使用预生成变体
        const variantsInfo = image.variants ? (typeof image.variants === 'string' ? JSON.parse(image.variants) : image.variants) : null;
        const matchedVariant = findBestVariantForResolution(resInfo.width, resInfo.height, variantsInfo);

        if (matchedVariant) {
          // 预生成变体存在，从 MinIO 获取变体文件
          const publicUrlBase = getPublicUrl("");
          const variantStorageKey = matchedVariant.url
            .replace(publicUrlBase + "/", "")
            .replace(publicUrlBase, "");
          buffer = await getObject(variantStorageKey);
          mimeType = "image/webp";
          fileName = `${image.title || "image"}_${resolution}.webp`;
        } else {
          // 回退到实时生成（旧图片无变体时的兼容逻辑）
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
        }
      } else {
        // 下载原文件（视频或无分辨率参数的图片）
        buffer = await getObject(image.storage_key);
        mimeType = image.mime_type || "image/jpeg";
        const ext = mimeType.split("/")[1] || "jpg";
        fileName = `${image.title || "image"}.${ext}`;
      }
    } catch (minioError: any) {
      console.error("MinIO访问失败，尝试使用公共URL重定向:", minioError);
      // MinIO访问失败时，重定向到公共URL
      let publicUrl: string;
      if (resolution && !isVideo) {
        // 对于指定分辨率的请求，先尝试获取变体的公共URL
        const resInfo = RESOLUTION_MAP.get(resolution);
        if (resInfo) {
          const variantsInfo = image.variants ? (typeof image.variants === 'string' ? JSON.parse(image.variants) : image.variants) : null;
          const matchedVariant = findBestVariantForResolution(resInfo.width, resInfo.height, variantsInfo);
          if (matchedVariant) {
            publicUrl = matchedVariant.url;
          } else {
            // 无匹配变体时使用原图URL
            publicUrl = getPublicUrl(image.storage_key);
          }
        } else {
          // 无效分辨率使用原图
          publicUrl = getPublicUrl(image.storage_key);
        }
      } else {
        // 原图或视频使用存储的公共URL
        publicUrl = getPublicUrl(image.storage_key);
      }
      
      // 重定向到公共URL
      return NextResponse.redirect(publicUrl, 302);
    }

    // 添加水印（仅图片，跳过视频；仅非原始分辨率下载时添加水印）
    if (!isVideo && resolution) {
      try {
        const watermarkEnabled = await isWatermarkEnabled();
        if (watermarkEnabled) {
          buffer = await addWatermark(buffer);
        }
      } catch (wmErr) {
        console.error("水印处理失败，返回原图:", wmErr);
      }
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