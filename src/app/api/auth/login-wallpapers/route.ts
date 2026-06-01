import { NextResponse } from "next/server";
import { getLoginWallpaperConfig, pickRandomWallpapers } from "@/lib/login-wallpapers";

export async function GET() {
  try {
    const config = await getLoginWallpaperConfig();

    let images: string[];
    if (config.source === "custom" && config.customUrls.length > 0) {
      // 使用自定义壁纸
      const pool = [...config.customUrls];
      images = [];
      while (images.length < 24 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        images.push(pool.splice(idx, 1)[0]);
      }
    } else {
      // 从 Unsplash 池随机选取
      images = pickRandomWallpapers(24);
    }

    return NextResponse.json({ images, source: config.source });
  } catch {
    return NextResponse.json({
      images: pickRandomWallpapers(24),
      source: "unsplash",
    });
  }
}
