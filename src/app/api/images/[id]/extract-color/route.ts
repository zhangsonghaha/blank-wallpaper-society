import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { extractColors } from "@/lib/color-extract";

// POST /api/images/[id]/extract-color - 为指定图片提取颜色信息并更新数据库
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = parseInt(id);

    if (isNaN(imageId)) {
      return NextResponse.json({ error: "无效的图片ID" }, { status: 400 });
    }

    // 查询图片信息
    const rows = (await query("SELECT * FROM images WHERE id = ?", [
      imageId,
    ])) as any[];

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const image = rows[0];

    // 从URL获取图片数据
    const imageUrl = image.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "图片URL不存在" },
        { status: 400 }
      );
    }

    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "无法下载图片" },
        { status: 400 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Downloaded image ID=${imageId}, size=${buffer.length} bytes, content-type=${response.headers.get("content-type")}`);

    // 提取颜色
    const { dominant, palette } = await extractColors(buffer);

    // 更新数据库
    await query(
      "UPDATE images SET dominant_color = ?, color_palette = ? WHERE id = ?",
      [dominant, JSON.stringify(palette), imageId]
    );

    return NextResponse.json({
      id: imageId,
      dominant_color: dominant,
      color_palette: palette,
      message: "颜色提取成功",
    });
  } catch (error: any) {
    console.error("POST /api/images/[id]/extract-color error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}