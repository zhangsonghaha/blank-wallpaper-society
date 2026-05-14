import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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

    let sql = "SELECT * FROM notifications WHERE user_id = ?";
    const params: any[] = [userId];

    if (unreadOnly) {
      sql += " AND is_read = 0";
    }

    if (type) {
      sql += " AND type = ?";
      params.push(type);
    }

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?${unreadOnly ? " AND is_read = 0" : ""}${type ? " AND type = ?" : ""}`;
    const countParams = [userId];
    if (type) countParams.push(type);
    const countResult = (await query(countSql, countParams)) as any[];
    const total = countResult[0]?.total || 0;

    // 获取未读数
    const unreadResult = (await query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    )) as any[];
    const unreadCount = unreadResult[0]?.count || 0;

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = await query(sql, params);

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
      await query(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
        [userId]
      );
      return NextResponse.json({ message: "全部标记已读" });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "请提供通知ID列表" }, { status: 400 });
    }

    const placeholders = ids.map(() => "?").join(",");
    await query(
      `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, userId]
    );

    return NextResponse.json({ message: "标记已读成功" });
  } catch (error: any) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}