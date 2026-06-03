import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { PLATFORM_FEE_RATE, MEMBERSHIP_PRICES } from "@/lib/earnings";
import { handlePaymentSuccess } from "@/lib/payment";

// GET /api/admin/orders - 获取订单列表（管理后台）
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const search = searchParams.get("search");

    const whereParts: ReturnType<typeof sql>[] = [];
    if (type) whereParts.push(sql`o.type = ${type}`);
    if (status) whereParts.push(sql`o.payment_status = ${status}`);
    if (search) {
      const searchPattern = `%${search}%`;
      whereParts.push(sql`(o.payment_id LIKE ${searchPattern} OR u.name LIKE ${searchPattern} OR u.email LIKE ${searchPattern})`);
    }

    const whereClause = whereParts.length > 0
      ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
      : sql``;

    const offset = (page - 1) * pageSize;

    const [orders, countResult] = await Promise.all([
      sql<{
        id: number; user_id: number; type: string; amount: string; payment_status: string;
        payment_method: string; payment_id: string; related_id: number; paid_at: string;
        created_at: string; buyer_name: string; buyer_email: string; description: string;
      }>`SELECT o.*, u.name as buyer_name, u.email as buyer_email,
          CASE o.type 
            WHEN 'paid_wallpaper' THEN (SELECT title FROM images WHERE id = o.related_id)
            WHEN 'tip' THEN CONCAT('打赏给用户#', o.related_id)
            WHEN 'membership' THEN CONCAT(o.amount, '元会员订阅')
          END as description
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`.execute(db),
      sql<{ total: string | number }>`SELECT COUNT(*) as total FROM orders o LEFT JOIN users u ON o.user_id = u.id ${whereClause}`.execute(db),
    ]);

    return NextResponse.json({
      data: orders.rows,
      total: Number(countResult.rows[0]?.total || 0),
      page,
      page_size: pageSize,
    });
  } catch (error: any) {
    console.error("GET /api/admin/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/orders - 管理员确认/拒绝订单
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = await request.json();
    const { order_id, action } = body;

    if (!order_id || !action) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    // 获取订单信息
    const orderRows = await db.selectFrom("orders")
      .where("id", "=", order_id)
      .selectAll()
      .execute();

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    const order = orderRows[0];

    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "订单状态不可操作" }, { status: 400 });
    }

    if (action === "confirm") {
      // 会员订单校验金额有效性
      if (order.type === "membership") {
        const validPrices = Object.values(MEMBERSHIP_PRICES);
        const EPSILON = 0.01;
        const isValidPrice = validPrices.some((p) => Math.abs(Number(order.amount) - p) < EPSILON);
        if (!isValidPrice) {
          return NextResponse.json(
            { error: `无法确认：订单金额 ${order.amount} 不是有效的会员价格（有效值: ${validPrices.join("/")}）` },
            { status: 400 }
          );
        }
      }

      // 确认支付：先将订单状态重置为pending，确保handlePaymentSuccess能正常处理
      await db.updateTable("orders")
        .set({ payment_status: "pending" })
        .where("id", "=", order_id)
        .execute();
      await handlePaymentSuccess(order_id, "alipay");
      const result = { order_id, action: "confirmed" };

      return NextResponse.json({ data: result, message: "订单已确认" });
    } else if (action === "reject") {
      // 拒绝订单
      await db.updateTable("orders")
        .set({ payment_status: "failed" })
        .where("id", "=", order_id)
        .execute();
      return NextResponse.json({ data: { order_id, action: "rejected" }, message: "订单已拒绝" });
    } else {
      return NextResponse.json({ error: "无效操作" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("PATCH /api/admin/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
