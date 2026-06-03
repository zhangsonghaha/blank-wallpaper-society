import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hexToRgb, colorDistance } from "@/lib/color-extract";

// GET /api/images/search/color - 按颜色搜索图片
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const color = searchParams.get("color");
    const threshold = parseInt(searchParams.get("threshold") || "30");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const offset = (page - 1) * limit;

    if (!color) {
      return NextResponse.json(
        { error: "请提供color参数（HEX格式，如 #E60023）" },
        { status: 400 }
      );
    }

    // 验证HEX格式
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexRegex.test(color)) {
      return NextResponse.json(
        { error: "颜色格式无效，请使用HEX格式（如 #E60023）" },
        { status: 400 }
      );
    }

    const targetRgb = hexToRgb(color);

    // 查询有颜色信息的图片
    let query = db
      .selectFrom("images")
      .where("dominant_color", "is not", null)
      .where("status", "=", "approved")
      .selectAll();

    if (category && category !== "all") {
      query = query.where("category", "=", category);
    }

    const rows = await query.execute();

    // 应用层筛选：计算色差
    const matched = rows.filter((row) => {
      if (!row.dominant_color) return false;

      const dominantRgb = hexToRgb(row.dominant_color);
      const dist = colorDistance(targetRgb, dominantRgb);

      // 同时检查调色板中的颜色
      let paletteMatch = false;
      if (row.color_palette) {
        try {
          const palette: string[] = JSON.parse(row.color_palette);
          for (const paletteColor of palette) {
            const paletteRgb = hexToRgb(paletteColor);
            const paletteDist = colorDistance(targetRgb, paletteRgb);
            if (paletteDist <= threshold) {
              paletteMatch = true;
              break;
            }
          }
        } catch {
          // JSON解析失败，忽略
        }
      }

      return dist <= threshold || paletteMatch;
    });

    // 按色差排序（越接近的排越前）
    matched.sort((a, b) => {
      const distA = colorDistance(targetRgb, hexToRgb(a.dominant_color!));
      const distB = colorDistance(targetRgb, hexToRgb(b.dominant_color!));
      return distA - distB;
    });

    const total = matched.length;
    const paginatedData = matched.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchColor: color,
      threshold,
    });
  } catch (error: any) {
    console.error("GET /api/images/search/color error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
