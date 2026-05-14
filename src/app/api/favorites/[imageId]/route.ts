import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

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
    const existing = (await query(
      `SELECT id FROM images WHERE id = ?`,
      [id]
    )) as any[];
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: "图片不存在" },
        { status: 404 }
      );
    }

    // 检查是否已收藏
    const existingFav = (await query(
      `SELECT id FROM favorites WHERE user_id = ? AND image_id = ?`,
      [userId, id]
    )) as any[];

    if (existingFav.length > 0) {
      return NextResponse.json(
        { success: false, error: "已收藏此图片" },
        { status: 409 }
      );
    }

    await query(
      `INSERT INTO favorites (user_id, image_id) VALUES (?, ?)`,
      [userId, id]
    );

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

    const result = await query(
      `DELETE FROM favorites WHERE user_id = ? AND image_id = ?`,
      [userId, id]
    ) as any;

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "未找到该收藏记录" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/favorites/[imageId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}