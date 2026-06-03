import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// POST /api/user/redeem-membership - 用户兑换会员码
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "请输入兑换码" }, { status: 400 });
    }

    const trimmedCode = code.trim().toUpperCase();

    // 使用 Kysely 事务处理兑换逻辑
    const result = await db.transaction().execute(async (trx) => {
      // 1. 查找兑换码 (FOR UPDATE)
      const codeRows = await trx
        .selectFrom("membership_redeem_codes")
        .selectAll()
        .where("code", "=", trimmedCode)
        .forUpdate()
        .execute();

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

      if (
        redeemCode.expires_at &&
        new Date(redeemCode.expires_at) < new Date()
      ) {
        // 自动标记为过期
        await trx
          .updateTable("membership_redeem_codes")
          .set({ status: "expired" })
          .where("id", "=", redeemCode.id)
          .executeTakeFirst();
        throw new Error("兑换码已过期");
      }

      // 3. 检查用户是否已兑换过该码
      const existingRedeem = await trx
        .selectFrom("membership_redeem_logs")
        .select("id")
        .where("code_id", "=", redeemCode.id)
        .where("user_id", "=", userId)
        .execute();

      if (existingRedeem.length > 0) {
        throw new Error("您已兑换过该兑换码");
      }

      // 4. 激活/续期会员
      const existingMembership = await trx
        .selectFrom("memberships")
        .select(["id", "expires_at"])
        .where("user_id", "=", userId)
        .where("status", "=", "active")
        .execute();

      let startDate = new Date();
      if (
        existingMembership.length > 0 &&
        new Date(existingMembership[0].expires_at!) > startDate
      ) {
        startDate = new Date(existingMembership[0].expires_at!);
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + redeemCode.duration_days);

      // 更新或创建会员记录 (ON DUPLICATE KEY UPDATE — 使用 raw SQL)
      await sql`
        INSERT INTO memberships (user_id, plan, started_at, expires_at, status, source, redeem_code_id)
        VALUES (${userId}, ${redeemCode.plan}, ${startDate}, ${endDate}, 'active', 'redeem_code', ${redeemCode.id})
        ON DUPLICATE KEY UPDATE plan = ${redeemCode.plan}, started_at = ${startDate}, expires_at = ${endDate}, status = 'active', source = 'redeem_code', redeem_code_id = ${redeemCode.id}
      `.execute(trx);

      // 获取会员ID
      const membershipRows = await trx
        .selectFrom("memberships")
        .select("id")
        .where("user_id", "=", userId)
        .execute();

      // 5. 更新兑换码使用次数
      await sql`UPDATE membership_redeem_codes SET used_count = used_count + 1 WHERE id = ${redeemCode.id}`.execute(trx);

      // 如果达到最大使用次数，标记为已完成
      if (redeemCode.used_count + 1 >= redeemCode.max_uses) {
        await trx
          .updateTable("membership_redeem_codes")
          .set({ status: "disabled" })
          .where("id", "=", redeemCode.id)
          .executeTakeFirst();
      }

      // 6. 记录兑换日志
      await trx
        .insertInto("membership_redeem_logs")
        .values({
          code_id: redeemCode.id,
          code: trimmedCode,
          user_id: userId,
          plan: redeemCode.plan,
          duration_days: redeemCode.duration_days,
          membership_id: membershipRows[0]?.id ?? null,
        })
        .executeTakeFirst();

      // 7. 发送通知
      await trx
        .insertInto("notifications")
        .values({
          user_id: userId,
          type: "order" as const,
          title: "会员兑换成功",
          content: `您已成功兑换${redeemCode.plan === "monthly" ? "月度" : "年度"}会员，有效期${redeemCode.duration_days}天，到期时间：${endDate.toLocaleDateString("zh-CN")}`,
        })
        .executeTakeFirst();

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
    const businessErrors = [
      "兑换码不存在",
      "兑换码已失效",
      "兑换码已用完",
      "兑换码已过期",
      "您已兑换过该兑换码",
    ];
    const status = businessErrors.includes(error.message) ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
