import { query } from "@/lib/db";

// === 收益配置 ===
export const PLATFORM_FEE_RATE = 0.15; // 平台抽成15%
export const TIP_AMOUNTS = [1, 5, 10]; // 固定打赏金额
export const MEMBERSHIP_PRICES = {
  monthly: 19.9,
  yearly: 149,
};
export const PAID_WALLPAPER_PRICE_RANGE = { min: 0.99, max: 9.99 };

// === 设置付费壁纸 ===
export async function setPaidWallpaper(
  imageId: number,
  userId: number,
  price: number
) {
  const { min, max } = PAID_WALLPAPER_PRICE_RANGE;
  if (price < min || price > max) {
    throw new Error(`价格范围: ${min} - ${max} 元`);
  }

  // 验证图片属于用户
  const image = (await query(
    "SELECT id FROM images WHERE id = ? AND uploaded_by = ? AND status = 'approved'",
    [imageId, userId]
  )) as any[];

  if (image.length === 0) {
    throw new Error("图片不存在或不属于你");
  }

  await query(
    `INSERT INTO paid_wallpapers (image_id, user_id, price) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE price = ?, is_paid = 1`,
    [imageId, userId, price, price]
  );

  return { imageId, price };
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

  // 创建订单
  const orderResult = await query(
    `INSERT INTO orders (user_id, type, related_id, amount, payment_status)
     VALUES (?, 'tip', NULL, ?, 'pending')`,
    [fromUserId, amount]
  );
  const orderId = (orderResult as any).insertId;

  // 创建打赏记录
  const tipResult = await query(
    `INSERT INTO tips (from_user_id, to_user_id, image_id, amount, message)
     VALUES (?, ?, ?, ?, ?)`,
    [fromUserId, toUserId, imageId || null, amount, message || null]
  );
  const tipId = (tipResult as any).insertId;

  // 更新订单关联
  await query("UPDATE orders SET related_id = ? WHERE id = ?", [tipId, orderId]);

  // TODO: 调用支付接口（微信/支付宝）
  // 此处简化为直接完成
  await query("UPDATE orders SET payment_status = 'paid', paid_at = NOW() WHERE id = ?", [orderId]);
  await query("UPDATE tips SET status = 'completed' WHERE id = ?", [tipId]);

  // 记录收益
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100;
  const netAmount = amount - platformFee;
  await query(
    `INSERT INTO earnings (user_id, type, related_id, amount, platform_fee, net_amount, status)
     VALUES (?, 'tip', ?, ?, ?, ?, 'pending')`,
    [toUserId, tipId, amount, platformFee, netAmount]
  );

  return { tipId, orderId, amount, netAmount };
}

// === 会员订阅 ===
export async function subscribeMembership(
  userId: number,
  plan: "monthly" | "yearly"
) {
  const price = MEMBERSHIP_PRICES[plan];

  // 检查是否已有有效会员
  const existing = (await query(
    "SELECT id, expires_at FROM memberships WHERE user_id = ? AND status = 'active'",
    [userId]
  )) as any[];

  let startDate = new Date();
  if (existing.length > 0 && new Date(existing[0].expires_at) > startDate) {
    startDate = new Date(existing[0].expires_at); // 从当前到期日续期
  }

  const endDate = new Date(startDate);
  if (plan === "monthly") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  // 创建订单
  const orderResult = await query(
    `INSERT INTO orders (user_id, type, amount, payment_status)
     VALUES (?, 'membership', ?, 'pending')`,
    [userId, price]
  );
  const orderId = (orderResult as any).insertId;

  // TODO: 调用支付接口

  // 更新或创建会员记录
  await query(
    `INSERT INTO memberships (user_id, plan, started_at, expires_at, status)
     VALUES (?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE plan = ?, started_at = ?, expires_at = ?, status = 'active'`,
    [userId, plan, startDate, endDate, plan, startDate, endDate]
  );

  // 更新订单状态
  await query("UPDATE orders SET payment_status = 'paid', paid_at = NOW() WHERE id = ?", [orderId]);

  return { orderId, plan, price, expiresAt: endDate };
}

// === 获取创作者收益概览 ===
export async function getEarningsOverview(userId: number) {
  // 总收益
  const totalEarnings = (await query(
    "SELECT COALESCE(SUM(net_amount), 0) as total FROM earnings WHERE user_id = ?",
    [userId]
  )) as any[];

  // 可提现收益
  const availableEarnings = (await query(
    "SELECT COALESCE(SUM(net_amount), 0) as total FROM earnings WHERE user_id = ? AND status = 'available'",
    [userId]
  )) as any[];

  // 待结算收益
  const pendingEarnings = (await query(
    "SELECT COALESCE(SUM(net_amount), 0) as total FROM earnings WHERE user_id = ? AND status = 'pending'",
    [userId]
  )) as any[];

  // 最近收益记录
  const recentEarnings = await query(
    `SELECT e.*, CASE e.type
       WHEN 'paid_download' THEN '付费下载'
       WHEN 'tip' THEN '打赏'
       WHEN 'membership_share' THEN '会员分成'
     END as type_label
     FROM earnings e
     WHERE e.user_id = ?
     ORDER BY e.created_at DESC
     LIMIT 20`,
    [userId]
  );

  return {
    total: totalEarnings[0]?.total || 0,
    available: availableEarnings[0]?.total || 0,
    pending: pendingEarnings[0]?.total || 0,
    recent: recentEarnings,
  };
}

// === 提现申请 ===
export async function requestWithdrawal(userId: number, amount: number) {
  const available = (await query(
    "SELECT COALESCE(SUM(net_amount), 0) as total FROM earnings WHERE user_id = ? AND status = 'available'",
    [userId]
  )) as any[];

  if (amount > (available[0]?.total || 0)) {
    throw new Error("可提现金额不足");
  }

  if (amount < 10) {
    throw new Error("最低提现金额为10元");
  }

  // 标记收益为已提现
  // 简化实现：按FIFO顺序标记
  const availableEarnings = (await query(
    "SELECT id, net_amount FROM earnings WHERE user_id = ? AND status = 'available' ORDER BY created_at ASC",
    [userId]
  )) as any[];

  let remaining = amount;
  for (const earning of availableEarnings) {
    if (remaining <= 0) break;
    if (earning.net_amount <= remaining) {
      await query("UPDATE earnings SET status = 'withdrawn' WHERE id = ?", [earning.id]);
      remaining -= earning.net_amount;
    } else {
      // 部分提现：拆分记录
      const left = earning.net_amount - remaining;
      await query("UPDATE earnings SET net_amount = ?, status = 'withdrawn' WHERE id = ?", [remaining, earning.id]);
      await query(
        "INSERT INTO earnings (user_id, type, amount, platform_fee, net_amount, status) VALUES (?, 'tip', 0, 0, ?, 'available')",
        [userId, left]
      );
      remaining = 0;
    }
  }

  return { amount, message: "提现申请已提交" };
}