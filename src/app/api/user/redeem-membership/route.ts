import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";

// POST /api/user/redeem-membership - 用户兑换会员码
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "请输入兑换码" }, { status: 400 });
    }

    const trimmedCode = code.trim().toUpperCase();

    // 使用事务处理兑换逻辑
    const result = await withTransaction(async (conn) => {
      // 1. 查找兑换码
      const [codeRows] = await conn.execute(
        "SELECT * FROM membership_redeem_codes WHERE code = ? FOR UPDATE",
        [trimmedCode]
      ) as [any[], any];

      if (codeRows.length === 0) {
        throw new Error("兑换码不存在");
      }

      const redeemCode = codeRows[0];

      // 2. 验证兑换码状态
      if (redeemCode.status !== "active") {
        throw new Error("兑换码已失效");
      }

      if (redeemCode.used_count >= redeemCode.max_uses) {
        throw new Error("兑换码已用完");
      }

      if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
        // 自动标记为过期
        await conn.execute(
          "UPDATE membership_redeem_codes SET status = 'expired' WHERE id = ?",
          [redeemCode.id]
        );
        throw new Error("兑换码已过期");
      }

      // 3. 检查用户是否已兑换过该码
      const [existingRedeem] = await conn.execute(
        "SELECT id FROM membership_redeem_logs WHERE code_id = ? AND user_id = ?",
        [redeemCode.id, userId]
      ) as [any[], any];

      if (existingRedeem.length > 0) {
        throw new Error("您已兑换过该兑换码");
      }

      // 4. 激活/续期会员
      const [existingMembership] = await conn.execute(
        "SELECT id, expires_at FROM memberships WHERE user_id = ? AND status = 'active'",
        [userId]
      ) as [any[], any];

      let startDate = new Date();
      if (existingMembership.length > 0 && new Date(existingMembership[0].expires_at) > startDate) {
        startDate = new Date(existingMembership[0].expires_at);
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + redeemCode.duration_days);

      // 更新或创建会员记录
      await conn.execute(
        `INSERT INTO memberships (user_id, plan, started_at, expires_at, status, source, redeem_code_id)
         VALUES (?, ?, ?, ?, 'active', 'redeem_code', ?)
         ON DUPLICATE KEY UPDATE plan = ?, started_at = ?, expires_at = ?, status = 'active', source = 'redeem_code', redeem_code_id = ?`,
        [userId, redeemCode.plan, startDate, endDate, redeemCode.id,
         redeemCode.plan, startDate, endDate, redeemCode.id]
      );

      // 获取会员ID
      const [membershipRows] = await conn.execute(
        "SELECT id FROM memberships WHERE user_id = ?",
        [userId]
      ) as [any[], any];

      // 5. 更新兑换码使用次数
      await conn.execute(
        "UPDATE membership_redeem_codes SET used_count = used_count + 1 WHERE id = ?",
        [redeemCode.id]
      );

      // 如果达到最大使用次数，标记为已完成
      if (redeemCode.used_count + 1 >= redeemCode.max_uses) {
        await conn.execute(
          "UPDATE membership_redeem_codes SET status = 'disabled' WHERE id = ?",
          [redeemCode.id]
        );
      }

      // 6. 记录兑换日志
      await conn.execute(
        `INSERT INTO membership_redeem_logs (code_id, code, user_id, plan, duration_days, membership_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [redeemCode.id, trimmedCode, userId, redeemCode.plan, redeemCode.duration_days, membershipRows[0]?.id]
      );

      // 7. 发送通知
      await conn.execute(
        `INSERT INTO notifications (user_id, type, title, content)
         VALUES (?, 'membership_redeem', ?, ?)`,
        [
          userId,
          "会员兑换成功",
          `您已成功兑换${redeemCode.plan === "monthly" ? "月度" : "年度"}会员，有效期${redeemCode.duration_days}天，到期时间：${endDate.toLocaleDateString("zh-CN")}`,
        ]
      );

      return {
        success: true,
        plan: redeemCode.plan,
        expiresAt: endDate,
        daysAdded: redeemCode.duration_days,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/user/redeem-membership error:", error);
    // 将业务错误返回为400而非500
    const businessErrors = ["兑换码不存在", "兑换码已失效", "兑换码已用完", "兑换码已过期", "您已兑换过该兑换码"];
    const status = businessErrors.includes(error.message) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}