import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";
import { MEMBERSHIP_PRICES } from "@/lib/earnings";

/**
 * 处理订单支付成功后的逻辑
 * @param orderId 订单ID
 * @param paymentMethod 支付方式
 */
export async function handlePaymentSuccess(orderId: number, paymentMethod: "wechat" | "alipay") {
  return await withTransaction(async (conn) => {
    // 1. 获取订单信息
    const [orderRows] = await conn.execute(
      "SELECT * FROM orders WHERE id = ? AND payment_status = 'pending'",
      [orderId]
    ) as [any[], any];

    if (orderRows.length === 0) {
      throw new Error("订单不存在或已支付");
    }

    const order = orderRows[0];

    // 2. 更新订单状态为已支付
    await conn.execute(
      "UPDATE orders SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP, payment_method = ? WHERE id = ?",
      [paymentMethod, orderId]
    );

    // 3. 根据订单类型处理后续逻辑
    switch (order.type) {
      case "membership":
        await handleMembershipPaymentSuccess(conn, order.user_id, order.amount);
        break;
      case "paid_wallpaper":
        await handlePaidWallpaperPaymentSuccess(conn, order.user_id, order.related_id);
        break;
      case "tip":
        await handleTipPaymentSuccess(conn, order.user_id, order.related_id, order.amount);
        break;
    }

    return { success: true, order };
  });
}

/**
 * 处理会员支付成功
 */
async function handleMembershipPaymentSuccess(conn: any, userId: number, amount: number) {
  // 确定会员套餐类型（使用近似比较避免浮点精度问题）
  // 注意：MySQL DECIMAL 类型通过 mysql2 返回字符串，需要转为数字
  const numAmount = Number(amount);
  const EPSILON = 0.01;
  const matchPrice = (target: number) => Math.abs(numAmount - target) < EPSILON;

  let plan: "monthly" | "yearly";
  if (matchPrice(MEMBERSHIP_PRICES.monthly)) {
    plan = "monthly";
  } else if (matchPrice(MEMBERSHIP_PRICES.yearly)) {
    plan = "yearly";
  } else if (matchPrice(MEMBERSHIP_PRICES.enterprise_monthly)) {
    plan = "monthly"; // 企业版暂时和普通版一致
  } else if (matchPrice(MEMBERSHIP_PRICES.enterprise_yearly)) {
    plan = "yearly";
  } else {
    throw new Error(`无效的会员金额: ${numAmount}，期望值: ${Object.values(MEMBERSHIP_PRICES).join('/')}`);
  }

  // 检查是否已有有效会员
  const [existingRows] = await conn.execute(
    "SELECT id, expires_at FROM memberships WHERE user_id = ? AND status = 'active'",
    [userId]
  ) as [any[], any];

  let startDate = new Date();
  if (existingRows.length > 0 && new Date(existingRows[0].expires_at) > startDate) {
    startDate = new Date(existingRows[0].expires_at); // 从当前到期日续期
  }

  const endDate = new Date(startDate);
  if (plan === "monthly") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // 更新或创建会员记录
  await conn.execute(
    `INSERT INTO memberships (user_id, plan, started_at, expires_at, status)
     VALUES (?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE plan = ?, started_at = ?, expires_at = ?, status = 'active'`,
    [userId, plan, startDate, endDate, plan, startDate, endDate]
  );
}

/**
 * 处理付费壁纸支付成功
 */
async function handlePaidWallpaperPaymentSuccess(conn: any, userId: number, imageId: number) {
  // 记录到用户已购买的壁纸（如果有对应的表的话，这里暂时留空）
  // TODO: 如果有付费壁纸购买记录表，在这里添加记录
}

/**
 * 处理打赏支付成功
 */
async function handleTipPaymentSuccess(conn: any, fromUserId: number, tipId: number, amount: number) {
  // 更新打赏记录状态
  await conn.execute(
    "UPDATE tips SET status = 'completed' WHERE id = ?",
    [tipId]
  );

  // 记录收益
  const platformFee = Math.round(amount * 0.15 * 100) / 100; // 平台抽成15%
  const netAmount = amount - platformFee;
  
  // 获取打赏接收用户ID
  const [tipRows] = await conn.execute(
    "SELECT to_user_id FROM tips WHERE id = ?",
    [tipId]
  ) as [any[], any];
  
  if (tipRows.length > 0) {
    const toUserId = tipRows[0].to_user_id;
    await conn.execute(
      `INSERT INTO earnings (user_id, type, related_id, amount, platform_fee, net_amount, status)
       VALUES (?, 'tip', ?, ?, ?, ?, 'pending')`,
      [toUserId, tipId, amount, platformFee, netAmount]
    );
  }
}

/**
 * 根据订单号查询订单
 */
export async function getOrderByPaymentId(paymentId: string) {
  const rows = await query(
    "SELECT * FROM orders WHERE payment_id = ?",
    [paymentId]
  ) as any[];
  
  return rows.length > 0 ? rows[0] : null;
}