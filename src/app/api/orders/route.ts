import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";
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

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // paid_wallpaper | tip | membership
    const status = searchParams.get("status"); // pending | paid | failed | refunded
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("page_size") || "20");

    let whereClause = "WHERE o.user_id = ?";
    const params: any[] = [userId];

    if (type) {
      whereClause += " AND o.type = ?";
      params.push(type);
    }
    if (status) {
      whereClause += " AND o.payment_status = ?";
      params.push(status);
    }

    const offset = (page - 1) * pageSize;

    const [orders, countResult] = await Promise.all([
      query(
        `SELECT o.*, 
          CASE o.type 
            WHEN 'paid_wallpaper' THEN (SELECT title FROM images WHERE id = o.related_id)
            WHEN 'tip' THEN (SELECT name FROM users WHERE id = o.related_id)
            WHEN 'membership' THEN CONCAT(o.amount, '元会员订阅')
          END as description
        FROM orders o ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
        params
      ),
    ]);

    return NextResponse.json({
      data: orders,
      total: (countResult as any[])[0]?.total || 0,
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

    const userId = (session.user as any).id;
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
        const paidRows = (await query(
          "SELECT price, user_id FROM paid_wallpapers WHERE image_id = ? AND is_paid = 1",
          [image_id]
        )) as any[];

        if (paidRows.length === 0) {
          return NextResponse.json({ error: "该壁纸不是付费壁纸" }, { status: 400 });
        }

        // 不能购买自己的壁纸
        if (paidRows[0].user_id === userId) {
          return NextResponse.json({ error: "不能购买自己的壁纸" }, { status: 400 });
        }

        // 检查是否已购买
        const existingOrder = (await query(
          "SELECT id FROM orders WHERE user_id = ? AND type = 'paid_wallpaper' AND related_id = ? AND payment_status = 'paid'",
          [userId, image_id]
        )) as any[];

        if (existingOrder.length > 0) {
          return NextResponse.json({ error: "已购买该壁纸" }, { status: 400 });
        }

        finalAmount = parseFloat(paidRows[0].price);
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
          return NextResponse.json({ error: "不能给自己打赏" }, { status: 400 });
        }
        relatedId = to_user_id;
        creatorId = to_user_id;
        break;
      }

      case "membership": {
        // 会员订阅 - 管理员无需订阅
        const userRole = (session.user as any).role;
        if (userRole === "admin") {
          return NextResponse.json({ error: "管理员无需订阅会员，您已拥有最高权限" }, { status: 400 });
        }
        if (!plan || !MEMBERSHIP_PRICES[plan as keyof typeof MEMBERSHIP_PRICES]) {
          return NextResponse.json({ error: "无效的套餐" }, { status: 400 });
        }
        finalAmount = MEMBERSHIP_PRICES[plan as keyof typeof MEMBERSHIP_PRICES];
        break;
      }

      default:
        return NextResponse.json({ error: "无效的订单类型" }, { status: 400 });
    }

    // 使用事务创建订单
    const result = await withTransaction(async (conn) => {
      const [orderResult] = await conn.execute(
        `INSERT INTO orders (user_id, type, related_id, amount, payment_status, payment_id)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        [userId, type, relatedId, finalAmount, orderNo]
      );
      const orderId = (orderResult as any).insertId;

      return { id: orderId, order_no: orderNo, amount: finalAmount };
    });

    // 异步通知管理员有新订单待确认
    const buyerName = (session.user as any).nickname || (session.user as any).email || `用户#${userId}`;
    let orderDescription = "";
    if (type === "paid_wallpaper") {
      const imgRows = (await query("SELECT title FROM images WHERE id = ?", [relatedId])) as any[];
      orderDescription = imgRows[0]?.title || `壁纸#${relatedId}`;
    } else if (type === "tip") {
      const toUserRows = (await query("SELECT nickname FROM users WHERE id = ?", [relatedId])) as any[];
      orderDescription = `打赏给 ${toUserRows[0]?.nickname || `用户#${relatedId}`}`;
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