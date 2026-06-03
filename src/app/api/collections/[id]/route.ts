import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";

// GET /api/collections/[id] - 获取合集详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id);

    const result = await sql<Record<string, any>>`
      SELECT c.*, 
        u.name as author_name, u.avatar as author_avatar,
        i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN images i ON c.cover_image_id = i.id
      WHERE c.id = ${collectionId}
    `.execute(db);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "合集不存在" }, { status: 404 });
    }

    const collection = result.rows[0] as any;

    // 如果是私密合集，只有创建者可以查看
    if (!collection.is_public) {
      const session = await auth();
      if (!session?.user || String((session.user as any).id) !== String(collection.user_id)) {
        return NextResponse.json({ error: "无权访问此合集" }, { status: 403 });
      }
    }

    // 检查当前用户是否已订阅
    const session = await auth();
    if (session?.user) {
      const currentUserId = (session.user as any).id;
      const sub = await db
        .selectFrom("collection_subscriptions")
        .select(["id"])
        .where("collection_id", "=", collectionId)
        .where("user_id", "=", currentUserId)
        .execute();
      collection.is_subscribed = sub.length > 0;
    }

    return NextResponse.json({ data: collection });
  } catch (error: any) {
    console.error("GET /api/collections/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/collections/[id] - 更新合集
export async function PATCH(
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
      return NextResponse.json({ error: "无权修改此合集" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }
    if (body.is_public !== undefined) {
      updateData.is_public = body.is_public ? 1 : 0;
    }
    if (body.cover_image_id !== undefined) {
      updateData.cover_image_id = body.cover_image_id || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    await db
      .updateTable("collections")
      .set(updateData)
      .where("id", "=", collectionId)
      .executeTakeFirst();

    // 返回更新后的合集
    const updated = await sql<Record<string, any>>`
      SELECT c.*, u.name as author_name, u.avatar as author_avatar,
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ${collectionId}
    `.execute(db);

    return NextResponse.json({ data: updated.rows[0] });
  } catch (error: any) {
    console.error("PATCH /api/collections/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/collections/[id] - 删除合集
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

    const existing = await db
      .selectFrom("collections")
      .selectAll()
      .where("id", "=", collectionId)
      .execute();
    if (existing.length === 0) {
      return NextResponse.json({ error: "合集不存在" }, { status: 404 });
    }
    if (String(existing[0].user_id) !== String(userId)) {
      return NextResponse.json({ error: "无权删除此合集" }, { status: 403 });
    }

    // CASCADE 会自动删除 collection_images 和 collection_subscriptions
    await db
      .deleteFrom("collections")
      .where("id", "=", collectionId)
      .executeTakeFirst();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/collections/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
