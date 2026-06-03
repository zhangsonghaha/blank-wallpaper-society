import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject, putBuffer, objectExists } from "@/lib/minio";
import { getResizedKey, RESOLUTIONS, RESOLUTION_MAP } from "@/lib/resolutions";
import sharp from "sharp";

// GET /api/images/[id]/resize - 获取指定图片的可用分辨率列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const image = await db
      .selectFrom("images")
      .where("id", "=", Number(id))
      .selectAll()
      .executeTakeFirst();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // 检查哪些分辨率已缓存
    const availableResolutions = await Promise.all(
      RESOLUTIONS.map(async (res) => {
        const resizedKey = getResizedKey(image.storage_key, res.width, res.height);
        const cached = await objectExists(resizedKey);
        return {
          ...res,
          cached,
        };
      })
    );

    return NextResponse.json({
      imageId: image.id,
      originalWidth: image.width,
      originalHeight: image.height,
      resolutions: availableResolutions,
    });
  } catch (error: any) {
    console.error("获取分辨率列表失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}

// POST /api/images/[id]/resize - 生成指定分辨率的图片
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution } = body;

    if (!resolution) {
      return NextResponse.json(
        { error: "请指定分辨率，如 1920x1080" },
        { status: 400 }
      );
    }

    const resInfo = RESOLUTION_MAP.get(resolution);
    if (!resInfo) {
      return NextResponse.json(
        { error: `不支持的分辨率: ${resolution}` },
        { status: 400 }
      );
    }

    const image = await db
      .selectFrom("images")
      .where("id", "=", Number(id))
      .selectAll()
      .executeTakeFirst();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const resizedKey = getResizedKey(
      image.storage_key,
      resInfo.width,
      resInfo.height
    );

    // 检查是否已缓存
    const exists = await objectExists(resizedKey);
    if (exists) {
      return NextResponse.json({
        message: "该分辨率已缓存",
        resolution: resInfo,
        storageKey: resizedKey,
      });
    }

    // 从MinIO获取原图
    const originalBuffer = await getObject(image.storage_key);

    // 使用Sharp处理图片：缩放 + 裁剪 + 转WebP
    const resizedBuffer = await sharp(originalBuffer)
      .resize(resInfo.width, resInfo.height, {
        fit: "cover",
        position: "center",
      })
      .webp({ quality: 90 })
      .toBuffer();

    // 上传到MinIO
    await putBuffer(resizedBuffer, resizedKey, "image/webp");

    return NextResponse.json({
      message: "分辨率图片生成成功",
      resolution: resInfo,
      storageKey: resizedKey,
      fileSize: resizedBuffer.length,
    });
  } catch (error: any) {
    console.error("生成分辨率图片失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}
