import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  opacity: number;
}

interface CalendarConfig {
  year: number;
  month: number;
  style: "minimal" | "modern" | "handwrite";
  position: "bottom" | "right";
  opacity: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  startOnMonday: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      imageUrl,
      crop,
      filterName,
      filterValues,
    } = body as {
      imageUrl: string;
      imageWidth: number;
      imageHeight: number;
      crop: CropArea | null;
      filterName: string;
      filterCSS: string;
      filterValues: Record<string, number>;
      textOverlays: TextOverlay[];
      calendarConfig: CalendarConfig | null;
    };

    if (!imageUrl) {
      return NextResponse.json({ error: "缺少图片URL" }, { status: 400 });
    }

    // 下载原图
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json({ error: "无法获取原图" }, { status: 400 });
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // 使用Sharp处理图片
    let pipeline = sharp(imageBuffer);

    // 应用裁剪
    if (crop && crop.width > 0 && crop.height > 0) {
      pipeline = pipeline.extract({
        left: Math.round(crop.x),
        top: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      });
    }

    // 应用滤镜
    if (filterName && filterName !== "original") {
      if (filterName === "grayscale") {
        pipeline = pipeline.grayscale();
      } else if (filterName === "blur") {
        const amount = filterValues?.amount ?? 5;
        pipeline = pipeline.blur(Math.min(amount, 20));
      } else if (filterName === "vintage") {
        const sepiaAmount = (filterValues?.amount ?? 60) / 100;
        const contrastVal = (filterValues?.contrast ?? 110) / 100;
        pipeline = pipeline
          .recomb([
            [0.3588 + (1 - 0.3588) * (1 - sepiaAmount), 0.7044 * sepiaAmount, 0.1368 * sepiaAmount],
            [0.2990 * sepiaAmount, 0.5870 + (1 - 0.5870) * (1 - sepiaAmount), 0.1140 * sepiaAmount],
            [0.2392 * sepiaAmount, 0.4696 * sepiaAmount, 0.0912 + (1 - 0.0912) * (1 - sepiaAmount)],
          ])
          .linear(contrastVal, -(0.5 * contrastVal) + 0.5);
      } else if (filterName === "warm") {
        const saturation = (filterValues?.saturate ?? 130) / 100;
        const sepiaAmount = (filterValues?.sepia ?? 20) / 100;
        pipeline = pipeline
          .modulate({ saturation })
          .recomb([
            [0.3588 * sepiaAmount + (1 - sepiaAmount), 0.7044 * sepiaAmount, 0.1368 * sepiaAmount],
            [0.2990 * sepiaAmount, 0.5870 * sepiaAmount + (1 - sepiaAmount), 0.1140 * sepiaAmount],
            [0.2392 * sepiaAmount, 0.4696 * sepiaAmount, 0.0912 * sepiaAmount + (1 - sepiaAmount)],
          ]);
      } else if (filterName === "cool") {
        const saturation = (filterValues?.saturate ?? 90) / 100;
        pipeline = pipeline.modulate({ saturation });
      } else if (filterName === "contrast") {
        const contrastVal = (filterValues?.amount ?? 150) / 100;
        const brightnessVal = (filterValues?.brightness ?? 105) / 100;
        pipeline = pipeline.linear(contrastVal * brightnessVal, -(0.5 * contrastVal * brightnessVal) + 0.5);
      }
    }

    // 输出PNG
    const processedBuffer = await pipeline.png({ quality: 95 }).toBuffer();

    return new NextResponse(new Uint8Array(processedBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="edited_${Date.now()}.png"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("导出失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 }
    );
  }
}