import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/collections/[id]/subscribe - 订阅合集
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

    // 验证合集存在
    const existing = (await query(
      `SELECT * FROM collections WHERE id = ?`,
      [collectionId]
    )) as any[];
    if (existing.length === 0) {
      return NextResponse.json({ error: "合集不存在" }, { status: 404 });
    }

    // 不能订阅自己的合集
    if (String(existing[0].user_id) === String(userId)) {
      return NextResponse.json({ error: "不能订阅自己的合集" }, { status: 400 });
    }

    // 检查是否已订阅
    const existingSub = (await query(
      `SELECT id FROM collection_subscriptions WHERE collection_id = ? AND user_id = ?`,
      [collectionId, userId]
    )) as any[];

    if (existingSub.length > 0) {
      return NextResponse.json({ error: "已订阅此合集" }, { status: 409 });
    }

    await query(
      `INSERT INTO collection_subscriptions (collection_id, user_id) VALUES (?, ?)`,
      [collectionId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/collections/[id]/subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/collections/[id]/subscribe - 取消订阅
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

    await query(
      `DELETE FROM collection_subscriptions WHERE collection_id = ? AND user_id = ?`,
      [collectionId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/collections/[id]/subscribe error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}