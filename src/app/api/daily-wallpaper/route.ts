import { NextRequest, NextResponse } from "next/server";
import { getDailyWallpaper } from "@/lib/daily-wallpaper";

// GET /api/daily-wallpaper - 获取每日壁纸
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "pick" | "collection" | undefined(全部)
    const date = searchParams.get("date"); // 查看指定日期（管理员功能）

    const data = await getDailyWallpaper(date || undefined);

    // 根据类型过滤返回内容
    if (type === "pick") {
      return NextResponse.json({
        date: data.date,
        pick: data.pick,
        theme: data.theme,
      });
    }

    if (type === "collection") {
      return NextResponse.json({
        date: data.date,
        collection: data.collection,
        theme: data.theme,
      });
    }

    // 默认返回完整数据
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("GET /api/daily-wallpaper error:", error);
    return NextResponse.json(
      { error: error.message || "获取每日壁纸失败" },
      { status: 500 }
    );
  }
}