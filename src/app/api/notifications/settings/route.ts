import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/notifications/settings - 获取当前用户的通知设置
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const rows = await query(
      "SELECT * FROM notification_settings WHERE user_id = ?",
      [userId]
    ) as any[];

    if (rows.length === 0) {
      // 返回默认设置
      return NextResponse.json({
        data: {
          notify_system: 1,
          notify_like: 1,
          notify_comment: 1,
          notify_review: 1,
          notify_follow: 1,
          notify_achievement: 1,
          notify_favorite: 1,
          email_system: 0,
          email_review: 1,
          email_achievement: 1,
        },
      });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    console.error("GET /api/notifications/settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/notifications/settings - 更新通知设置
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();

    // 允许更新的字段
    const allowedFields = [
      "notify_system",
      "notify_like",
      "notify_comment",
      "notify_review",
      "notify_follow",
      "notify_achievement",
      "notify_favorite",
      "email_system",
      "email_review",
      "email_achievement",
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = ?`);
        values.push(body[field] ? 1 : 0);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    // 检查是否已有记录
    const existing = await query(
      "SELECT id FROM notification_settings WHERE user_id = ?",
      [userId]
    ) as any[];

    if (existing.length === 0) {
      // 创建记录
      const fields = ["user_id", ...updates.map((u) => u.split(" = ")[0])];
      const placeholders = fields.map(() => "?").join(", ");
      const fieldValues = [userId, ...values];
      await query(
        `INSERT INTO notification_settings (${fields.join(", ")}) VALUES (${placeholders})`,
        fieldValues
      );
    } else {
      // 更新记录
      values.push(userId);
      await query(
        `UPDATE notification_settings SET ${updates.join(", ")} WHERE user_id = ?`,
        values
      );
    }

    // 返回更新后的设置
    const updated = await query(
      "SELECT * FROM notification_settings WHERE user_id = ?",
      [userId]
    ) as any[];

    return NextResponse.json({
      message: "通知设置已更新",
      data: updated[0],
    });
  } catch (error: any) {
    console.error("PATCH /api/notifications/settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}