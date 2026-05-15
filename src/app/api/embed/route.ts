import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/embed - 获取嵌入数据（壁纸展示 / 每日壁纸）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "wallpaper"; // wallpaper / daily
    const imageId = searchParams.get("imageId");
    const theme = searchParams.get("theme") || "light"; // light / dark
    const size = searchParams.get("size") || "medium"; // small / medium / large

    if (type === "wallpaper" && imageId) {
      // 单张壁纸嵌入数据
      const rows = await query(
        `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height, i.author,
                u.name as author_name
         FROM images i
         LEFT JOIN users u ON i.uploaded_by = u.id
         WHERE i.id = ? AND i.status = 'approved'`,
        [imageId]
      ) as any[];

      if (rows.length === 0) {
        return NextResponse.json({ error: "图片不存在" }, { status: 404 });
      }

      // 记录展示统计
      await query(
        "INSERT INTO embed_stats (image_id, embed_type, referrer, event_type) VALUES (?, 'wallpaper', ?, 'impression')",
        [imageId, request.headers.get("referer") || ""]
      );

      return NextResponse.json({
        data: {
          ...rows[0],
          siteUrl: process.env.NEXT_PUBLIC_URL || "https://bws.example.com",
          theme,
          size,
        },
      });
    }

    if (type === "daily") {
      // 每日壁纸嵌入数据
      const today = new Date().toISOString().split("T")[0];
      const dailyRows = await query(
        `SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height, i.author,
                u.name as author_name
         FROM images i
         LEFT JOIN users u ON i.uploaded_by = u.id
         WHERE i.status = 'approved'
         ORDER BY i.download_count DESC, i.view_count DESC
         LIMIT 1`
      ) as any[];

      if (dailyRows.length === 0) {
        return NextResponse.json({ error: "暂无壁纸" }, { status: 404 });
      }

      // 记录展示统计
      await query(
        "INSERT INTO embed_stats (image_id, embed_type, referrer, event_type) VALUES (?, 'daily', ?, 'impression')",
        [dailyRows[0].id, request.headers.get("referer") || ""]
      );

      return NextResponse.json({
        data: {
          ...dailyRows[0],
          siteUrl: process.env.NEXT_PUBLIC_URL || "https://bws.example.com",
          theme,
          date: today,
        },
      });
    }

    return NextResponse.json({ error: "无效的嵌入类型" }, { status: 400 });
  } catch (error: any) {
    console.error("GET /api/embed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/embed - 记录嵌入点击事件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageId, embedType, referrer } = body;

    if (!imageId) {
      return NextResponse.json({ error: "缺少imageId" }, { status: 400 });
    }

    await query(
      "INSERT INTO embed_stats (image_id, embed_type, referrer, event_type) VALUES (?, ?, ?, 'click')",
      [imageId, embedType || "wallpaper", referrer || ""]
    );

    return NextResponse.json({ message: "记录成功" });
  } catch (error: any) {
    console.error("POST /api/embed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}