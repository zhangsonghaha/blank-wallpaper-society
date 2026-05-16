import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getObject } from "@/lib/minio";
import { generateAndUploadVariants } from "@/lib/image-variants";
import sharp from "sharp";

/**
 * POST /api/admin/generate-variants
 * 为所有未生成变体的图片批量生成变体
 * 支持参数：?limit=100 每批处理数量
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    // 查询未生成变体的图片（variants 为 NULL 或为空）
    const images = await query(
      `SELECT id, storage_key, width, height, mime_type FROM images 
       WHERE (variants IS NULL OR JSON_LENGTH(variants) = 0) 
       AND width > 0 AND height > 0 
       AND (mime_type IS NULL OR mime_type LIKE 'image/%')
       ORDER BY id ASC 
       LIMIT ${limit}`,
      []
    ) as any[];

    if (images.length === 0) {
      return NextResponse.json({
        message: "没有需要生成变体的图片",
        processed: 0,
        failed: 0,
        totalPending: 0,
      });
    }

    // 查询总待处理数量
    const totalResult = await query(
      `SELECT COUNT(*) as count FROM images 
       WHERE (variants IS NULL OR JSON_LENGTH(variants) = 0) 
       AND width > 0 AND height > 0 
       AND (mime_type IS NULL OR mime_type LIKE 'image/%')`
    ) as any[];
    const totalPending = totalResult[0]?.count || 0;

    let processed = 0;
    let failed = 0;
    const errors: { id: number; error: string }[] = [];

    // 逐个处理（避免并发过大导致服务器压力）
    for (const image of images) {
      try {
        // 从 MinIO 获取原图
        const originalBuffer = await getObject(image.storage_key);

        // 获取原图尺寸（优先用数据库记录，fallback 到 Sharp 解析）
        let width = image.width;
        let height = image.height;
        if (!width || !height) {
          const metadata = await sharp(originalBuffer).metadata();
          width = metadata.width || 0;
          height = metadata.height || 0;
        }

        if (width === 0 || height === 0) {
          failed++;
          errors.push({ id: image.id, error: "无法获取图片尺寸" });
          continue;
        }

        // 生成并上传变体
        const { variants, thumbnails } = await generateAndUploadVariants(
          image.id,
          originalBuffer,
          width,
          height
        );

        // 更新数据库
        await query(
          "UPDATE images SET variants = ?, thumbnails = ? WHERE id = ?",
          [JSON.stringify(variants), JSON.stringify(thumbnails), image.id]
        );

        processed++;
      } catch (err: any) {
        failed++;
        errors.push({ id: image.id, error: err.message || "未知错误" });
        console.error(`生成变体失败 (imageId=${image.id}):`, err);
      }
    }

    return NextResponse.json({
      message: `批量生成完成：成功 ${processed}，失败 ${failed}`,
      processed,
      failed,
      totalPending: totalPending - processed,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // 最多返回10条错误
    });
  } catch (error: any) {
    console.error("批量生成变体API错误:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/generate-variants
 * 查询变体生成状态统计
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 统计已有变体的图片数
    const withVariants = await query(
      `SELECT COUNT(*) as count FROM images WHERE variants IS NOT NULL AND JSON_LENGTH(variants) > 0`
    ) as any[];

    // 统计未生成变体的图片数
    const withoutVariants = await query(
      `SELECT COUNT(*) as count FROM images 
       WHERE (variants IS NULL OR JSON_LENGTH(variants) = 0) 
       AND width > 0 AND height > 0 
       AND (mime_type IS NULL OR mime_type LIKE 'image/%')`
    ) as any[];

    // 总图片数
    const totalImages = await query(
      `SELECT COUNT(*) as count FROM images`
    ) as any[];

    return NextResponse.json({
      totalImages: totalImages[0]?.count || 0,
      withVariants: withVariants[0]?.count || 0,
      withoutVariants: withoutVariants[0]?.count || 0,
      progress: totalImages[0]?.count > 0
        ? Math.round((withVariants[0]?.count / totalImages[0]?.count) * 100)
        : 0,
    });
  } catch (error: any) {
    console.error("查询变体状态API错误:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}