import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/notifications - 管理员获取所有通知（带用户信息）
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const type = searchParams.get("type");
    const userId = searchParams.get("userId");

    let sql = `
      SELECT n.*, u.name as user_name, u.email as user_email
      FROM notifications n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      sql += " AND n.type = ?";
      params.push(type);
    }
    if (userId) {
      sql += " AND n.user_id = ?";
      params.push(userId);
    }

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM notifications n WHERE 1=1${type ? " AND n.type = ?" : ""}${userId ? " AND n.user_id = ?" : ""}`;
    const countResult = (await query(countSql, params)) as any[];
    const total = countResult[0]?.total || 0;

    // 获取未读数
    const unreadResult = (await query(
      "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0"
    )) as any[];
    const unreadCount = unreadResult[0]?.count || 0;

    // 获取类型分布
    const typeDist = (await query(
      "SELECT type, COUNT(*) as count FROM notifications GROUP BY type ORDER BY count DESC"
    )) as any[];

    sql += " ORDER BY n.created_at DESC LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = await query(sql, params);

    return NextResponse.json({
      data: rows,
      total,
      unreadCount,
      typeDistribution: typeDist,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/admin/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/notifications - 管理员发送通知（支持群发）
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const { userIds, title, content, type = "system" } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "通知标题不能为空" }, { status: 400 });
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "请选择接收通知的用户" }, { status: 400 });
    }

    // 批量插入通知
    const values = userIds
      .map((uid: number) => `(${uid}, '${type}', '${title.trim().replace(/'/g, "\\'")}', ${content ? `'${content.trim().replace(/'/g, "\\'")}'` : "NULL"})`)
      .join(", ");

    await query(
      `INSERT INTO notifications (user_id, type, title, content) VALUES ${values}`
    );

    return NextResponse.json(
      { message: `已向 ${userIds.length} 位用户发送通知` },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/admin/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/notifications - 管理员删除通知
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "缺少通知ID" }, { status: 400 });
    }

    const result = await query("DELETE FROM notifications WHERE id = ?", [id]);
    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "通知不存在" }, { status: 404 });
    }

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}