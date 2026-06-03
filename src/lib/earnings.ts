import { db } from "@/lib/db";
import { sql } from "kysely";

// === 收益配置 ===
export const PLATFORM_FEE_RATE = 0.15; // 平台抽成15%
export const TIP_AMOUNTS = [1, 5, 10]; // 固定打赏金额
export const MEMBERSHIP_PRICES = {
  monthly: 19.9,
  yearly: 149,
  enterprise_monthly: 99,
  enterprise_yearly: 950,
};
export const PAID_WALLPAPER_PRICE_RANGE = { min: 0.99, max: 9.99 };

// === 设置付费壁纸 ===
export async function setPaidWallpaper(
  imageId: number,
  userId: number,
  price: number,
  isAdmin: boolean = false
) {
  const { min, max } = PAID_WALLPAPER_PRICE_RANGE;
  if (price < min || price > max) {
    throw new Error(`价格范围: ${min} - ${max} 元`);
  }

  // 验证图片存在
  const image = await db
    .selectFrom("images")
    .select(["id", "uploaded_by"])
    .where("id", "=", imageId)
    .where("status", "=", "approved")
    .$if(!isAdmin, (qb) => qb.where("uploaded_by", "=", userId))
    .execute();

  if (image.length === 0) {
    throw new Error("图片不存在或不可用");
  }

  const creatorId = image[0].uploaded_by || userId;

  await sql`
    INSERT INTO paid_wallpapers (image_id, user_id, price) VALUES (${imageId}, ${creatorId}, ${price})
    ON DUPLICATE KEY UPDATE price = ${price}, is_paid = 1
  `.execute(db);

  return { imageId, price };
}

// === 取消付费壁纸 ===
export async function unsetPaidWallpaper(imageId: number) {
  await db
    .updateTable("paid_wallpapers")
    .set({ is_paid: 0 })
    .where("image_id", "=", imageId)
    .execute();
  return { imageId, unset: true };
}

// === 打赏 ===
export async function createTip(
  fromUserId: number,
  toUserId: number,
  amount: number,
  imageId?: number,
  message?: string
) {
  if (fromUserId === toUserId) throw new Error("不能给自己打赏");
  if (!TIP_AMOUNTS.includes(amount)) throw new Error("无效的打赏金额");

  // 使用事务保护打赏流程，确保订单、打赏记录和收益一致性
  const result = await db.transaction().execute(async (trx) => {
    // 创建订单
    const orderResult = await trx
      .insertInto("orders")
      .values({
        user_id: fromUserId,
        type: "tip",
        related_id: null,
        amount: amount,
        payment_status: "pending",
      })
      .executeTakeFirst();
    const orderId = Number(orderResult.insertId);

    // 创建打赏记录
    const tipResult = await trx
      .insertInto("tips")
      .values({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        image_id: imageId || null,
        amount: amount,
        message: message || null,
      })
      .executeTakeFirst();
    const tipId = Number(tipResult.insertId);

    // 更新订单关联
    await trx
      .updateTable("orders")
      .set({ related_id: tipId })
      .where("id", "=", orderId)
      .execute();

    // TODO: 调用支付接口（微信/支付宝）
    // 此处简化为直接完成
    await trx
      .updateTable("orders")
      .set({ payment_status: "paid", paid_at: sql`NOW()` })
      .where("id", "=", orderId)
      .execute();

    await trx
      .updateTable("tips")
      .set({ status: "completed" })
      .where("id", "=", tipId)
      .execute();

    // 记录收益
    const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
    const netAmount = amount - platformFee;
    await trx
      .insertInto("earnings")
      .values({
        user_id: toUserId,
        type: "tip",
        related_id: tipId,
        amount: amount,
        platform_fee: platformFee,
        net_amount: netAmount,
        status: "pending",
      })
      .executeTakeFirst();

    return { tipId, orderId, amount, netAmount };
  });

  return result;
}

// === 会员订阅 ===
export async function subscribeMembership(
  userId: number,
  plan: "monthly" | "yearly"
) {
  const price = MEMBERSHIP_PRICES[plan];

  // 检查是否已有有效会员
  const existing = await db
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

  // 使用事务保护会员订阅流程
  const result = await db.transaction().execute(async (trx) => {
    // 创建订单
    const orderResult = await trx
      .insertInto("orders")
      .values({
        user_id: userId,
        type: "membership",
        amount: price,
        payment_status: "pending",
      })
      .executeTakeFirst();
    const orderId = Number(orderResult.insertId);

    // TODO: 调用支付接口

    // 更新或创建会员记录
    await sql`
      INSERT INTO memberships (user_id, plan, started_at, expires_at, status)
      VALUES (${userId}, ${plan}, ${startDate.toISOString()}, ${endDate.toISOString()}, 'active')
      ON DUPLICATE KEY UPDATE plan = ${plan}, started_at = ${startDate.toISOString()}, expires_at = ${endDate.toISOString()}, status = 'active'
    `.execute(trx);

    // 更新订单状态
    await trx
      .updateTable("orders")
      .set({ payment_status: "paid", paid_at: sql`NOW()` })
      .where("id", "=", orderId)
      .execute();

    return { orderId, plan, price, expiresAt: endDate };
  });

  return result;
}

// === 获取创作者收益概览 ===
export async function getEarningsOverview(userId: number) {
  // 总收益
  const totalResult = await db
    .selectFrom("earnings")
    .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("net_amount"), sql<number>`0`).as("total"))
    .where("user_id", "=", userId)
    .executeTakeFirst();

  // 可提现收益
  const availableResult = await db
    .selectFrom("earnings")
    .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("net_amount"), sql<number>`0`).as("total"))
    .where("user_id", "=", userId)
    .where("status", "=", "available")
    .executeTakeFirst();

  // 待结算收益
  const pendingResult = await db
    .selectFrom("earnings")
    .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("net_amount"), sql<number>`0`).as("total"))
    .where("user_id", "=", userId)
    .where("status", "=", "pending")
    .executeTakeFirst();

  // 最近收益记录
  const recentEarnings = await db
    .selectFrom("earnings")
    .selectAll()
    .select((eb) =>
      sql<string>`CASE type
        WHEN 'paid_download' THEN '付费下载'
        WHEN 'tip' THEN '打赏'
        WHEN 'membership_share' THEN '会员分成'
      END`.as("type_label")
    )
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(20)
    .execute();

  return {
    total: Number(totalResult?.total) || 0,
    available: Number(availableResult?.total) || 0,
    pending: Number(pendingResult?.total) || 0,
    recent: recentEarnings,
  };
}

// === 提现申请 ===
export async function requestWithdrawal(userId: number, amount: number) {
  const availableResult = await db
    .selectFrom("earnings")
    .select((eb) => eb.fn.coalesce(eb.fn.sum<number>("net_amount"), sql<number>`0`).as("total"))
    .where("user_id", "=", userId)
    .where("status", "=", "available")
    .executeTakeFirst();

  if (amount > (Number(availableResult?.total) || 0)) {
    throw new Error("可提现金额不足");
  }

  if (amount < 10) {
    throw new Error("最低提现金额为10元");
  }

  // 标记收益为已提现
  // 简化实现：按FIFO顺序标记
  const availableEarnings = await db
    .selectFrom("earnings")
    .select(["id", "net_amount"])
    .where("user_id", "=", userId)
    .where("status", "=", "available")
    .orderBy("created_at", "asc")
    .execute();

  let remaining = amount;
  for (const earning of availableEarnings) {
    if (remaining <= 0) break;
    const netAmt = Number(earning.net_amount);
    if (netAmt <= remaining) {
      await db
        .updateTable("earnings")
        .set({ status: "withdrawn" })
        .where("id", "=", earning.id)
        .execute();
      remaining -= netAmt;
    } else {
      // 部分提现：拆分记录
      const left = netAmt - remaining;
      await db
        .updateTable("earnings")
        .set({ net_amount: remaining.toFixed(2), status: "withdrawn" })
        .where("id", "=", earning.id)
        .execute();
      await db
        .insertInto("earnings")
        .values({
          user_id: userId,
          type: "tip",
          amount: 0,
          platform_fee: 0,
          net_amount: left,
          status: "available",
        })
        .executeTakeFirst();
      remaining = 0;
    }
  }

  return { amount, message: "提现申请已提交" };
}
