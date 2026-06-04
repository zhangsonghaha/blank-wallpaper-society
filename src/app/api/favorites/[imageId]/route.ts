import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { addExp, checkAchievements } from "@/lib/user-level";
import { notifyNewFavorite } from "@/lib/notification";
import { clearPattern } from "@/lib/redis";

// POST /api/favorites/[imageId] - 添加收藏
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const { imageId } = await params;
    const id = parseInt(imageId);
    const userId = (session.user as any).id;

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "无效的图片ID" },
        { status: 400 }
      );
    }

    // 验证图片存在
    const existing = await db
      .selectFrom("images")
      .select(["id"])
      .where("id", "=", id)
      .execute();
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "图片不存在" },
        { status: 404 }
      );
    }

    // 检查是否已收藏
    const existingFav = await db
      .selectFrom("favorites")
      .select(["id"])
      .where("user_id", "=", userId)
      .where("image_id", "=", id)
      .execute();

    if (existingFav.length > 0) {
      return NextResponse.json(
        { success: false, error: "已收藏此图片" },
        { status: 409 }
      );
    }

    await db
      .insertInto("favorites")
      .values({
        user_id: userId,
        image_id: id,
      })
      .executeTakeFirst();

    // 更新图片收藏计数
    sql`UPDATE images SET favorite_count = (SELECT COUNT(*) FROM favorites WHERE image_id = ${id}) WHERE id = ${id}`
      .execute(db)
      .catch(() => {});

    // 收藏成功 -> 图片作者 +5 exp + 检查成就（异步不阻塞）
    db
      .selectFrom("images")
      .select(["uploaded_by", "title"])
      .where("id", "=", id)
      .execute()
      .then((rows) => {
        const authorId = (rows as any[])?.[0]?.uploaded_by;
        const imageTitle = (rows as any[])?.[0]?.title || `图片#${id}`;
        if (authorId) {
          addExp(authorId, 5).catch(() => {});
          checkAchievements(authorId).catch(() => {});
          // 通知图片作者
          const userName = (session.user as any).name || "用户";
          notifyNewFavorite(authorId, userName, imageTitle, id).catch(() => {});
        }
      })
      .catch(() => {});
    // 收藏者自身也检查成就（收藏达人）
    checkAchievements(userId).catch(() => {});

    // 缓存失效：图片列表可能因收藏数变化而需刷新
    await clearPattern("images:list:*");

    return NextResponse.json({ success: true, data: { imageId: id } }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/favorites/[imageId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/favorites/[imageId] - 取消收藏
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const { imageId } = await params;
    const id = parseInt(imageId);
    const userId = (session.user as any).id;

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: "无效的图片ID" },
        { status: 400 }
      );
    }

    const result = await db
      .deleteFrom("favorites")
      .where("user_id", "=", userId)
      .where("image_id", "=", id)
      .executeTakeFirst();

    const affectedRows = Number(result.numDeletedRows);

    // 更新图片收藏计数
    if (affectedRows > 0) {
      sql`UPDATE images SET favorite_count = (SELECT COUNT(*) FROM favorites WHERE image_id = ${id}) WHERE id = ${id}`
        .execute(db)
        .catch(() => {});
    }

    if (affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "未找到该收藏记录" },
        { status: 404 }
      );
    }

    // 缓存失效
    await clearPattern("images:list:*");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/favorites/[imageId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
