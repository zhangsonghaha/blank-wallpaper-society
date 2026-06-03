import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import {
  PLATFORM_FEE_RATE,
  MEMBERSHIP_PRICES,
  PAID_WALLPAPER_PRICE_RANGE,
} from "@/lib/earnings";
import { notifyNewOrder } from "@/lib/notification";

// 生成订单号: ORD + 日期 + 随机数
function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${dateStr}${rand}`;
}

// GET /api/orders - 获取当前用户订单列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // paid_wallpaper | tip | membership
    const status = searchParams.get("status"); // pending | paid | failed | refunded
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");
    const offset = (page - 1) * pageSize;

    // Build dynamic WHERE clause with Kysely
    const applyFilters = (qb: any) => {
      qb = qb.where("o.user_id", "=", userId);
      if (type) qb = qb.where("o.type", "=", type);
      if (status) qb = qb.where("o.payment_status", "=", status);
      return qb;
    };

    const [orders, countResult] = await Promise.all([
      sql<any>`
        SELECT o.*, 
          CASE o.type 
            WHEN 'paid_wallpaper' THEN (SELECT title FROM images WHERE id = o.related_id)
            WHEN 'tip' THEN (SELECT name FROM users WHERE id = o.related_id)
            WHEN 'membership' THEN CONCAT(o.amount, '元会员订阅')
          END as description
        FROM orders o
        WHERE o.user_id = ${userId}
        ${type ? sql`AND o.type = ${type}` : sql``}
        ${status ? sql`AND o.payment_status = ${status}` : sql``}
        ORDER BY o.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `.execute(db).then(r => r.rows),

      db
        .selectFrom("orders as o")
        .select((eb) => [eb.fn.count("o.id").as("total")])
        .$call((qb) => applyFilters(qb))
        .execute(),
    ]);

    return NextResponse.json({
      data: orders,
      total: Number((countResult[0] as any)?.total) || 0,
      page,
      page_size: pageSize,
    });
  } catch (error: any) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/orders - 创建订单
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const body = await request.json();
    const { type, amount, image_id, to_user_id, plan } = body;

    if (!type || !amount) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const orderNo = generateOrderNo();
    let relatedId: number | null = null;
    let finalAmount = parseFloat(amount);
    let creatorId: number | null = null;

    switch (type) {
      case "paid_wallpaper": {
        // 购买付费壁纸
        if (!image_id) {
          return NextResponse.json({ error: "缺少图片ID" }, { status: 400 });
        }

        // 检查图片是否为付费壁纸
        const paidRows = await db
          .selectFrom("paid_wallpapers")
          .select(["price", "user_id"])
          .where("image_id", "=", image_id)
          .where("is_paid", "=", 1)
          .execute();

        if (paidRows.length === 0) {
          return NextResponse.json(
            { error: "该壁纸不是付费壁纸" },
            { status: 400 }
          );
        }

        // 不能购买自己的壁纸
        if (paidRows[0].user_id === userId) {
          return NextResponse.json(
            { error: "不能购买自己的壁纸" },
            { status: 400 }
          );
        }

        // 检查是否已购买
        const existingOrder = await db
          .selectFrom("orders")
          .select("id")
          .where("user_id", "=", userId)
          .where("type", "=", "paid_wallpaper")
          .where("related_id", "=", image_id)
          .where("payment_status", "=", "paid")
          .execute();

        if (existingOrder.length > 0) {
          return NextResponse.json(
            { error: "已购买该壁纸" },
            { status: 400 }
          );
        }

        finalAmount = parseFloat(String(paidRows[0].price));
        creatorId = paidRows[0].user_id;
        relatedId = image_id;
        break;
      }

      case "tip": {
        // 打赏
        if (!to_user_id) {
          return NextResponse.json({ error: "缺少打赏对象" }, { status: 400 });
        }
        if (to_user_id === userId) {
          return NextResponse.json(
            { error: "不能给自己打赏" },
            { status: 400 }
          );
        }
        relatedId = to_user_id;
        creatorId = to_user_id;
        break;
      }

      case "membership": {
        // 会员订阅 - 管理员无需订阅
        const userRole = (session.user as any).role;
        if (userRole === "admin") {
          return NextResponse.json(
            { error: "管理员无需订阅会员，您已拥有最高权限" },
            { status: 400 }
          );
        }
        if (!plan || !MEMBERSHIP_PRICES[plan as keyof typeof MEMBERSHIP_PRICES]) {
          return NextResponse.json({ error: "无效的套餐" }, { status: 400 });
        }
        finalAmount =
          MEMBERSHIP_PRICES[plan as keyof typeof MEMBERSHIP_PRICES];
        break;
      }

      default:
        return NextResponse.json({ error: "无效的订单类型" }, { status: 400 });
    }

    // 使用 Kysely 事务创建订单
    const result = await db.transaction().execute(async (trx) => {
      const insertResult = await trx
        .insertInto("orders")
        .values({
          user_id: userId,
          type: type,
          related_id: relatedId,
          amount: String(finalAmount),
          payment_status: "pending",
          payment_id: orderNo,
        })
        .executeTakeFirst();

      const orderId = Number(insertResult.insertId);

      return { id: orderId, order_no: orderNo, amount: finalAmount };
    });

    // 异步通知管理员有新订单待确认
    const buyerName =
      (session.user as any).nickname ||
      (session.user as any).email ||
      `用户#${userId}`;
    let orderDescription = "";
    if (type === "paid_wallpaper") {
      const imgRows = await db
        .selectFrom("images")
        .select("title")
        .where("id", "=", relatedId!)
        .execute();
      orderDescription = imgRows[0]?.title || `壁纸#${relatedId}`;
    } else if (type === "tip") {
      const toUserRows = await db
        .selectFrom("users")
        .select("name")
        .where("id", "=", relatedId!)
        .execute();
      orderDescription = `打赏给 ${toUserRows[0]?.name || `用户#${relatedId}`}`;
    } else if (type === "membership") {
      orderDescription = `${finalAmount}元会员订阅`;
    }

    notifyNewOrder({
      orderId: result.id,
      orderNo: result.order_no,
      orderType: type as "paid_wallpaper" | "tip" | "membership",
      amount: finalAmount,
      buyerName,
      description: orderDescription,
    }).catch((err) => {
      console.error("[Orders] 通知管理员失败:", err);
    });

    return NextResponse.json(
      { data: result, message: "订单创建成功，请完成支付" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
