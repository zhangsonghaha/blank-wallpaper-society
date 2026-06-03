import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/user/downloads - 获取当前用户的下载历史
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 查询下载历史，关联图片信息
    const rows = await db
      .selectFrom("download_logs as dl")
      .innerJoin("images as i", "i.id", "dl.image_id")
      .select([
        "dl.id",
        "dl.resolution",
        "dl.created_at as downloaded_at",
        "i.id as image_id",
        "i.title",
        "i.url",
        "i.thumbnail_url",
        "i.width",
        "i.height",
        "i.author",
        "i.category",
        "i.dominant_color",
      ])
      .where("dl.user_id", "=", Number(userId))
      .orderBy("dl.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 查询总数
    const countRows = await db
      .selectFrom("download_logs")
      .select((eb) => [eb.fn.count("id").as("total")])
      .where("user_id", "=", Number(userId))
      .execute();

    const total = Number(countRows[0]?.total) || 0;

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/user/downloads error:", error);
    return NextResponse.json(
      { error: error.message || "获取下载历史失败" },
      { status: 500 }
    );
  }
}
