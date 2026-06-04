import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { deleteFile } from "@/lib/minio";
import { auth } from "@/lib/auth";
import { indexImage, deleteImage as deleteSearchIndex, dbRowToSearchData } from "@/lib/meilisearch";
import { getOrSet, delCache, clearPattern, CacheKeys, CacheTTL } from "@/lib/redis";

// GET /api/images/[id] - 获取单张图片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = Number(id);

    const image = await getOrSet(
      CacheKeys.IMAGE_DETAIL(imageId),
      async () => {
        const row = await db
          .selectFrom("images")
          .where("id", "=", imageId)
          .selectAll()
          .executeTakeFirst();
        if (!row) return null;

        // 增加浏览次数
        await db
          .updateTable("images")
          .set({ view_count: sql`view_count + 1` })
          .where("id", "=", imageId)
          .execute();

        return row;
      },
      CacheTTL.IMAGE_DETAIL
    );

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    return NextResponse.json(image);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/images/[id] - 更新图片信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = Number(id);
    const body = await request.json();
    const { title, description, author, tags, category, is_favorite } = body;

    // is_favorite 需要用户登录，操作 favorites 表
    if (is_favorite !== undefined) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      const userId = (session.user as any).id;

      if (is_favorite) {
        // 添加收藏（忽略重复）
        await sql`INSERT IGNORE INTO favorites (user_id, image_id) VALUES (${userId}, ${imageId})`.execute(db);
      } else {
        // 取消收藏
        await db
          .deleteFrom("favorites")
          .where("user_id", "=", userId)
          .where("image_id", "=", imageId)
          .execute();
      }

      // 如果只有 is_favorite 字段，直接返回
      if (
        title === undefined &&
        description === undefined &&
        author === undefined &&
        tags === undefined &&
        category === undefined
      ) {
        // 缓存失效
        await delCache(CacheKeys.IMAGE_DETAIL(imageId));
        await clearPattern("images:list:*");
        return NextResponse.json({ success: true, message: "更新成功" });
      }
    }

    // Build dynamic update object
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (author !== undefined) updateData.author = author;
    if (tags !== undefined) updateData.tags = tags;
    if (category !== undefined) updateData.category = category;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    await db
      .updateTable("images")
      .set(updateData)
      .where("id", "=", imageId)
      .execute();

    // 更新 Meilisearch 索引
    try {
      const updatedImage = await db
        .selectFrom("images")
        .where("id", "=", imageId)
        .selectAll()
        .executeTakeFirst();
      if (updatedImage) {
        if (updatedImage.status === "approved") {
          indexImage(dbRowToSearchData(updatedImage)).catch(() => {});
        } else {
          deleteSearchIndex(imageId).catch(() => {});
        }
      }
    } catch {}

    // 缓存失效：清除该图片详情和列表缓存
    await delCache(CacheKeys.IMAGE_DETAIL(imageId));
    await clearPattern("images:list:*");

    return NextResponse.json({ success: true, message: "更新成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/images/[id] - 删除图片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = Number(id);

    const image = await db
      .selectFrom("images")
      .where("id", "=", imageId)
      .selectAll()
      .executeTakeFirst();

    if (!image) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // 删除 MinIO 中的文件
    try {
      await deleteFile(image.storage_key);
      if (image.thumbnail_url) {
        const thumbKey = image.thumbnail_url.split("/").slice(-2).join("/");
        await deleteFile(thumbKey);
      }
    } catch (err) {
      console.warn("删除 MinIO 文件失败:", err);
    }

    // 删除数据库记录
    await db.deleteFrom("images").where("id", "=", imageId).execute();

    // 从 Meilisearch 索引中删除
    deleteSearchIndex(imageId).catch(() => {});

    // 缓存失效
    await delCache(CacheKeys.IMAGE_DETAIL(imageId));
    await clearPattern("images:list:*");

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
