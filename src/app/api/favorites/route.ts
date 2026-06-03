import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/favorites - 获取当前用户的收藏列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    // 获取总数
    const countResult = await db
      .selectFrom("favorites")
      .select((eb) => [eb.fn.countAll().as("total")])
      .where("user_id", "=", userId)
      .execute();
    const total = Number(countResult[0]?.total ?? 0);

    // 关联images表获取图片详情
    const rows = await db
      .selectFrom("favorites")
      .innerJoin("images", "images.id", "favorites.image_id")
      .select((eb) => [
        eb.ref("favorites.id").as("favorite_id"),
        eb.ref("favorites.created_at").as("favorited_at"),
        "images.id",
        "images.title",
        "images.description",
        "images.url",
        "images.thumbnail_url",
        "images.width",
        "images.height",
        "images.category",
        "images.tags",
        "images.author",
        "images.view_count",
        "images.download_count",
        "images.created_at",
        "images.dominant_color",
        "images.storage_key",
      ])
      .where("favorites.user_id", "=", userId)
      .orderBy("favorites.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return NextResponse.json({
      success: true,
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/favorites error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
