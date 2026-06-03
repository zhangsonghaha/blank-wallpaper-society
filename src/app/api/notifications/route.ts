import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/notifications - 获取当前用户的通知列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const unreadOnly = searchParams.get("unread") === "true";
    const type = searchParams.get("type");

    // Build base query for notifications
    let query = db.selectFrom("notifications").selectAll().where("user_id", "=", userId);

    if (unreadOnly) {
      query = query.where("is_read", "=", 0);
    }
    if (type) {
      query = query.where("type", "=", type as any);
    }

    // 获取总数
    let countQuery = db.selectFrom("notifications").select((eb) => [eb.fn.count<number>("id").as("total")]).where("user_id", "=", userId);
    if (unreadOnly) {
      countQuery = countQuery.where("is_read", "=", 0);
    }
    if (type) {
      countQuery = countQuery.where("type", "=", type as any);
    }

    const [countResult, unreadResult, rows] = await Promise.all([
      countQuery.executeTakeFirst(),
      db.selectFrom("notifications")
        .select((eb) => [eb.fn.count<number>("id").as("count")])
        .where("user_id", "=", userId)
        .where("is_read", "=", 0)
        .executeTakeFirst(),
      query.orderBy("created_at", "desc").limit(limit).offset(offset).execute(),
    ]);

    const total = Number(countResult?.total ?? 0);
    const unreadCount = Number(unreadResult?.count ?? 0);

    return NextResponse.json({
      data: rows,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/notifications - 批量标记已读
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { ids, markAll } = body;

    if (markAll) {
      // 标记所有未读为已读
      await db
        .updateTable("notifications")
        .set({ is_read: 1 })
        .where("user_id", "=", userId)
        .where("is_read", "=", 0)
        .executeTakeFirst();
      return NextResponse.json({ message: "全部标记已读" });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "请提供通知ID列表" }, { status: 400 });
    }

    await db
      .updateTable("notifications")
      .set({ is_read: 1 })
      .where("id", "in", ids)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return NextResponse.json({ message: "标记已读成功" });
  } catch (error: any) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
