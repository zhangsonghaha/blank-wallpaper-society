import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
    const collectionRows = (await query(
      `SELECT * FROM collections WHERE id = ?`,
      [collectionId]
    )) as any[];
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

    const countResult = (await query(
      `SELECT COUNT(*) as total FROM collection_images WHERE collection_id = ?`,
      [collectionId]
    )) as any[];
    const total = countResult[0]?.total || 0;

    const rows = (await query(
      `SELECT i.*, ci.sort_order, ci.added_at
      FROM collection_images ci
      JOIN images i ON ci.image_id = i.id
      WHERE ci.collection_id = ?
      ORDER BY ci.sort_order ASC, ci.added_at DESC
      LIMIT ? OFFSET ?`,
      [collectionId, limit, offset]
    )) as any[];

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
    const existing = (await query(
      `SELECT * FROM collections WHERE id = ?`,
      [collectionId]
    )) as any[];
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
    const existingImage = (await query(
      `SELECT id FROM collection_images WHERE collection_id = ? AND image_id = ?`,
      [collectionId, imageId]
    )) as any[];

    if (existingImage.length > 0) {
      return NextResponse.json({ error: "图片已在合集中" }, { status: 409 });
    }

    // 获取当前最大排序值
    const maxSort = (await query(
      `SELECT MAX(sort_order) as max_order FROM collection_images WHERE collection_id = ?`,
      [collectionId]
    )) as any[];
    const sortOrder = (maxSort[0]?.max_order || 0) + 1;

    await query(
      `INSERT INTO collection_images (collection_id, image_id, sort_order) VALUES (?, ?, ?)`,
      [collectionId, imageId, sortOrder]
    );

    // 如果合集没有封面，自动设置第一张图片为封面
    if (!existing[0].cover_image_id) {
      await query(
        `UPDATE collections SET cover_image_id = ? WHERE id = ?`,
        [imageId, collectionId]
      );
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
    const existing = (await query(
      `SELECT * FROM collections WHERE id = ?`,
      [collectionId]
    )) as any[];
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

    await query(
      `DELETE FROM collection_images WHERE collection_id = ? AND image_id = ?`,
      [collectionId, parseInt(imageId)]
    );

    // 如果移除的是封面图片，自动更换为第一张图片
    if (String(existing[0].cover_image_id) === imageId) {
      const firstImage = (await query(
        `SELECT image_id FROM collection_images WHERE collection_id = ? ORDER BY sort_order ASC, added_at DESC LIMIT 1`,
        [collectionId]
      )) as any[];
      await query(
        `UPDATE collections SET cover_image_id = ? WHERE id = ?`,
        [firstImage[0]?.image_id || null, collectionId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/collections/[id]/images error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}