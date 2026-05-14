import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// PATCH /api/notifications/[id] - 标记单条通知已读
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    const notificationId = parseInt(id);

    if (isNaN(notificationId)) {
      return NextResponse.json({ error: "无效的通知ID" }, { status: 400 });
    }

    const result = await query(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "通知不存在或无权限" }, { status: 404 });
    }

    return NextResponse.json({ message: "标记已读成功" });
  } catch (error: any) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] - 删除通知
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    const notificationId = parseInt(id);

    if (isNaN(notificationId)) {
      return NextResponse.json({ error: "无效的通知ID" }, { status: 400 });
    }

    const result = await query(
      "DELETE FROM notifications WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "通知不存在或无权限" }, { status: 404 });
    }

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}