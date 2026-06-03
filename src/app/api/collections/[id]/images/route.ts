import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/collections/[id]/images - 获取合集内图片列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const offset = (page - 1) * limit;

    // 验证合集存在
    const collectionRows = await db
      .selectFrom("collections")
      .selectAll()
      .where("id", "=", collectionId)
      .execute();
    if (collectionRows.length === 0) {
      return NextResponse.json({ error: "合集不存在" }, { status: 404 });
    }

    // 私密合集权限检查
    if (!collectionRows[0].is_public) {
      const session = await auth();
      if (!session?.user || String((session.user as any).id) !== String(collectionRows[0].user_id)) {
        return NextResponse.json({ error: "无权访问此合集" }, { status: 403 });
      }
    }

    const countResult = await db
      .selectFrom("collection_images")
      .select((eb) => [eb.fn.countAll().as("total")])
      .where("collection_id", "=", collectionId)
      .execute();
    const total = Number(countResult[0]?.total ?? 0);

    const rows = await db
      .selectFrom("collection_images")
      .innerJoin("images", "images.id", "collection_images.image_id")
      .select((eb) => [
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
        "collection_images.sort_order",
        "collection_images.added_at",
      ])
      .where("collection_images.collection_id", "=", collectionId)
      .orderBy("collection_images.sort_order", "asc")
      .orderBy("collection_images.added_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/collections/[id]/images error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/collections/[id]/images - 添加图片到合集
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    const collectionId = parseInt(id);
    const userId = (session.user as any).id;

    // 验证权限
    const existing = await db
      .selectFrom("collections")
      .selectAll()
      .where("id", "=", collectionId)
      .execute();
    if (existing.length === 0) {
      return NextResponse.json({ error: "合集不存在" }, { status: 404 });
    }
    if (String(existing[0].user_id) !== String(userId)) {
      return NextResponse.json({ error: "无权操作此合集" }, { status: 403 });
    }

    const body = await request.json();
    const { imageId } = body;

    if (!imageId) {
      return NextResponse.json({ error: "请指定图片ID" }, { status: 400 });
    }

    // 检查图片是否已在合集中
    const existingImage = await db
      .selectFrom("collection_images")
      .select(["id"])
      .where("collection_id", "=", collectionId)
      .where("image_id", "=", imageId)
      .execute();

    if (existingImage.length > 0) {
      return NextResponse.json({ error: "图片已在合集中" }, { status: 409 });
    }

    // 获取当前最大排序值
    const maxSortResult = await db
      .selectFrom("collection_images")
      .select((eb) => [eb.fn.max("sort_order").as("max_order")])
      .where("collection_id", "=", collectionId)
      .execute();
    const sortOrder = (Number(maxSortResult[0]?.max_order) || 0) + 1;

    await db
      .insertInto("collection_images")
      .values({
        collection_id: collectionId,
        image_id: imageId,
        sort_order: sortOrder,
      })
      .executeTakeFirst();

    // 如果合集没有封面，自动设置第一张图片为封面
    if (!existing[0].cover_image_id) {
      await db
        .updateTable("collections")
        .set({ cover_image_id: imageId })
        .where("id", "=", collectionId)
        .executeTakeFirst();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/collections/[id]/images error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/collections/[id]/images - 从合集移除图片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    const collectionId = parseInt(id);
    const userId = (session.user as any).id;

    // 验证权限
    const existing = await db
      .selectFrom("collections")
      .selectAll()
      .where("id", "=", collectionId)
      .execute();
    if (existing.length === 0) {
      return NextResponse.json({ error: "合集不存在" }, { status: 404 });
    }
    if (String(existing[0].user_id) !== String(userId)) {
      return NextResponse.json({ error: "无权操作此合集" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json({ error: "请指定图片ID" }, { status: 400 });
    }

    await db
      .deleteFrom("collection_images")
      .where("collection_id", "=", collectionId)
      .where("image_id", "=", parseInt(imageId))
      .executeTakeFirst();

    // 如果移除的是封面图片，自动更换为第一张图片
    if (String(existing[0].cover_image_id) === imageId) {
      const firstImage = await db
        .selectFrom("collection_images")
        .select(["image_id"])
        .where("collection_id", "=", collectionId)
        .orderBy("sort_order", "asc")
        .orderBy("added_at", "desc")
        .limit(1)
        .execute();
      await db
        .updateTable("collections")
        .set({ cover_image_id: firstImage[0]?.image_id ?? null })
        .where("id", "=", collectionId)
        .executeTakeFirst();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/collections/[id]/images error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
