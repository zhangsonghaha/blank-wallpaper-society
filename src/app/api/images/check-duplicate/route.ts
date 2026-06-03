import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { computePHash, hammingDistance } from "@/lib/phash";

// pHash 去重阈值
const PHASH_THRESHOLD = 5;

/**
 * POST /api/images/check-duplicate
 * 上传前预检：接收图片 buffer，计算 pHash 并返回相似图片列表
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    let buffer: Buffer;

    if (contentType.includes("application/json")) {
      // JSON 模式：接收 base64 编码的图片
      const body = await request.json();
      if (!body.image) {
        return NextResponse.json({ error: "请提供图片数据" }, { status: 400 });
      }
      buffer = Buffer.from(body.image, "base64");
    } else {
      // FormData 模式
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "请提供图片文件" }, { status: 400 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
    }

    // 计算 pHash
    let phash: string | null = null;
    try {
      phash = await computePHash(buffer);
    } catch {
      return NextResponse.json({ error: "无法计算图片指纹" }, { status: 400 });
    }

    if (!phash) {
      return NextResponse.json({ duplicates: [] });
    }

    // 查询数据库中所有已有 pHash
    const existingImages = await db
      .selectFrom("images")
      .where("phash", "is not", null)
      .select(["id", "title", "url", "thumbnail_url", "phash"])
      .execute();

    // 找出相似图片
    const duplicates = existingImages
      .filter((img) => img.phash && hammingDistance(phash, img.phash) <= PHASH_THRESHOLD)
      .map((img) => ({
        id: img.id,
        title: img.title,
        url: img.url,
        thumbnail_url: img.thumbnail_url,
        similarity: Math.round(((64 - hammingDistance(phash, img.phash!)) / 64) * 100),
      }));

    return NextResponse.json({
      phash,
      duplicates,
      isDuplicate: duplicates.length > 0,
    });
  } catch (error: any) {
    console.error("POST /api/images/check-duplicate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
