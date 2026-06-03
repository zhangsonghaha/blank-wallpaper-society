import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/notifications/settings - 获取当前用户的通知设置
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const rows = await db
      .selectFrom("notification_settings")
      .selectAll()
      .where("user_id", "=", userId)
      .execute();

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
    ] as const;

    const updateObj: Record<string, number> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updateObj[field] = body[field] ? 1 : 0;
      }
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    // 检查是否已有记录
    const existing = await db
      .selectFrom("notification_settings")
      .select("id")
      .where("user_id", "=", userId)
      .execute();

    if (existing.length === 0) {
      // 创建记录
      await db
        .insertInto("notification_settings")
        .values({ user_id: userId, ...updateObj })
        .executeTakeFirst();
    } else {
      // 更新记录
      await db
        .updateTable("notification_settings")
        .set(updateObj)
        .where("user_id", "=", userId)
        .executeTakeFirst();
    }

    // 返回更新后的设置
    const updated = await db
      .selectFrom("notification_settings")
      .selectAll()
      .where("user_id", "=", userId)
      .execute();

    return NextResponse.json({
      message: "通知设置已更新",
      data: updated[0],
    });
  } catch (error: any) {
    console.error("PATCH /api/notifications/settings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
