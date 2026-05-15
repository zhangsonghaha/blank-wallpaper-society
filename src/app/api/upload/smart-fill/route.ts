import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { extractExif, ExifData } from "@/lib/exif";
import { extractColors } from "@/lib/color-extract";
import { suggestTags, suggestTitle, suggestCategoryByColor } from "@/lib/tag-suggest";

export interface SmartFillResult {
  suggestedTitle: string;
  suggestedTags: string[];
  suggestedCategory: string;
  exif: ExifData;
  dominantColor: string;
  colorPalette: string[];
}

/**
 * POST /api/upload/smart-fill
 * 接收图片 buffer，返回智能填充建议
 */
export async function POST(request: NextRequest) {
  try {
    // 用户认证
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 解析 FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    // 读取文件 buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name;

    // 并行提取 EXIF 和色彩
    const [exifResult, colorResult] = await Promise.all([
      extractExif(buffer).catch((err) => {
        console.warn("EXIF 提取失败:", err);
        return {} as ExifData;
      }),
      extractColors(buffer).catch((err) => {
        console.warn("色彩提取失败:", err);
        return { dominant: "#808080", palette: ["#808080"] };
      }),
    ]);

    const dominantColor = colorResult.dominant;

    // 生成推荐分类
    const suggestedCategory = category || suggestCategoryByColor(dominantColor);

    // 生成推荐标签（并行）
    const suggestedTags = await suggestTags({
      filename,
      category: suggestedCategory,
      dominantColor,
      topN: 8,
    });

    // 生成推荐标题
    const suggestedTitle = suggestTitle({
      filename,
      category: suggestedCategory,
      dominantColor,
    });

    const result: SmartFillResult = {
      suggestedTitle,
      suggestedTags,
      suggestedCategory,
      exif: exifResult,
      dominantColor,
      colorPalette: colorResult.palette,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Smart fill error:", error);
    return NextResponse.json(
      { error: "智能填充失败，请重试" },
      { status: 500 }
    );
  }
}