import { db } from "@/lib/db";
import { sql } from "kysely";
import type { Transaction } from "kysely";
import type { DB } from "@/lib/db-types";
import { MEMBERSHIP_PRICES } from "@/lib/earnings";

/**
 * 处理订单支付成功后的逻辑
 * @param orderId 订单ID
 * @param paymentMethod 支付方式
 */
export async function handlePaymentSuccess(orderId: number, paymentMethod: "wechat" | "alipay") {
  return await db.transaction().execute(async (trx) => {
    // 1. 获取订单信息
    const orders = await trx
      .selectFrom("orders")
      .where("id", "=", orderId)
      .where("payment_status", "=", "pending")
      .selectAll()
      .execute();

    if (orders.length === 0) {
      throw new Error("订单不存在或已支付");
    }

    const order = orders[0];

    // 2. 更新订单状态为已支付
    await trx
      .updateTable("orders")
      .set({
        payment_status: "paid",
        paid_at: sql`NOW()`,
        payment_method: paymentMethod,
      })
      .where("id", "=", orderId)
      .execute();

    // 3. 根据订单类型处理后续逻辑
    switch (order.type) {
      case "membership":
        await handleMembershipPaymentSuccess(trx, order.user_id, order.amount);
        break;
      case "paid_wallpaper":
        await handlePaidWallpaperPaymentSuccess(trx, order.user_id, order.related_id!);
        break;
      case "tip":
        await handleTipPaymentSuccess(trx, order.user_id, order.related_id!, order.amount);
        break;
    }

    return { success: true, order };
  });
}

/**
 * 处理会员支付成功
 */
async function handleMembershipPaymentSuccess(trx: Transaction<DB>, userId: number, amount: number | string) {
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
  const existing = await trx
    .selectFrom("memberships")
    .select(["id", "expires_at"])
    .where("user_id", "=", userId)
    .where("status", "=", "active")
    .execute();

  let startDate = new Date();
  if (existing.length > 0 && existing[0].expires_at && new Date(existing[0].expires_at) > startDate) {
    startDate = new Date(existing[0].expires_at); // 从当前到期日续期
  }

  const endDate = new Date(startDate);
  if (plan === "monthly") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // 更新或创建会员记录 (INSERT ... ON DUPLICATE KEY UPDATE)
  await sql`
    INSERT INTO memberships (user_id, plan, started_at, expires_at, status)
    VALUES (${userId}, ${plan}, ${startDate.toISOString()}, ${endDate.toISOString()}, 'active')
    ON DUPLICATE KEY UPDATE plan = ${plan}, started_at = ${startDate.toISOString()}, expires_at = ${endDate.toISOString()}, status = 'active'
  `.execute(trx);
}

/**
 * 处理付费壁纸支付成功
 */
async function handlePaidWallpaperPaymentSuccess(trx: Transaction<DB>, userId: number, imageId: number) {
  // 记录到用户已购买的壁纸（如果有对应的表的话，这里暂时留空）
  // TODO: 如果有付费壁纸购买记录表，在这里添加记录
}

/**
 * 处理打赏支付成功
 */
async function handleTipPaymentSuccess(trx: Transaction<DB>, fromUserId: number, tipId: number, amount: number | string) {
  // 更新打赏记录状态
  await trx
    .updateTable("tips")
    .set({ status: "completed" })
    .where("id", "=", tipId)
    .execute();

  // 记录收益
  const numAmount = Number(amount);
  const platformFee = Math.round(numAmount * 0.15 * 100) / 100; // 平台抽成15%
  const netAmount = numAmount - platformFee;

  // 获取打赏接收用户ID
  const tips = await trx
    .selectFrom("tips")
    .select(["to_user_id"])
    .where("id", "=", tipId)
    .execute();

  if (tips.length > 0) {
    const toUserId = tips[0].to_user_id;
    await trx
      .insertInto("earnings")
      .values({
        user_id: toUserId,
        type: "tip",
        related_id: tipId,
        amount: numAmount,
        platform_fee: platformFee,
        net_amount: netAmount,
        status: "pending",
      })
      .executeTakeFirst();
  }
}

/**
 * 根据订单号查询订单
 */
export async function getOrderByPaymentId(paymentId: string) {
  const rows = await db
    .selectFrom("orders")
    .where("payment_id", "=", paymentId)
    .selectAll()
    .execute();

  return rows.length > 0 ? rows[0] : null;
}
