import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { clearPattern } from "@/lib/redis";

// GET /api/admin/membership - 获取会员统计和列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "stats";

    if (action === "stats") {
      // 会员统计
      const [activeCountRes, expiringCountRes, totalMembersRes, planDistribution, recentGrants] = await Promise.all([
        // 活跃会员数
        db.selectFrom("memberships")
          .select((eb) => eb.fn.countAll().as("count"))
          .where("status", "=", "active")
          .where("expires_at", ">", sql<Date>`NOW()`)
          .executeTakeFirst(),
        // 即将到期（7天内）
        db.selectFrom("memberships")
          .select((eb) => eb.fn.countAll().as("count"))
          .where("status", "=", "active")
          .where("expires_at", ">=", sql<Date>`NOW()`)
          .where("expires_at", "<=", sql<Date>`DATE_ADD(NOW(), INTERVAL 7 DAY)`)
          .executeTakeFirst(),
        // 总会员数（含过期）
        db.selectFrom("memberships")
          .select((eb) => eb.fn.countAll().as("count"))
          .executeTakeFirst(),
        // 套餐分布
        db.selectFrom("memberships")
          .select((eb) => ["plan", eb.fn.countAll().as("count")])
          .where("status", "=", "active")
          .where("expires_at", ">", sql<Date>`NOW()`)
          .groupBy("plan")
          .execute(),
        // 最近发放记录
        db.selectFrom("memberships as m")
          .leftJoin("users as u", "m.user_id", "u.id")
          .leftJoin("users as g", "m.granted_by", "g.id")
          .selectAll("m")
          .select(["u.name as user_name", "g.name as granter_name"])
          .where("m.source", "in", ["admin_grant", "redeem_code"])
          .orderBy("m.created_at", "desc")
          .limit(10)
          .execute(),
      ]);

      return NextResponse.json({
        stats: {
          activeCount: Number(activeCountRes?.count ?? 0),
          expiringCount: Number(expiringCountRes?.count ?? 0),
          totalMembers: Number(totalMembersRes?.count ?? 0),
          planDistribution,
        },
        recentGrants,
      });
    }

    if (action === "members") {
      // 会员列表（分页）
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "20");
      const search = searchParams.get("search") || "";
      const planFilter = searchParams.get("plan") || "";
      const statusFilter = searchParams.get("status") || "";
      const offset = (page - 1) * limit;

      // 构建带动态条件的查询
      const applyFilters = (qb: any) =>
        qb
          .$if(!!search, (q: any) => q.where((eb: any) => eb.or([
            eb("u.name", "like", `%${search}%`),
            eb("u.email", "like", `%${search}%`),
          ])))
          .$if(!!planFilter, (q: any) => q.where("m.plan", "=", planFilter))
          .$if(statusFilter === "active", (q: any) => q.where("m.status", "=", "active").where("m.expires_at", ">", sql<Date>`NOW()`))
          .$if(statusFilter === "expired", (q: any) => q.where((eb: any) => eb.or([
            eb("m.status", "=", "expired"),
            eb("m.expires_at", "<=", sql<Date>`NOW()`),
          ])));

      const countResult = await applyFilters(
        db.selectFrom("memberships as m")
          .leftJoin("users as u", "m.user_id", "u.id")
          .select((eb) => eb.fn.countAll().as("count"))
      ).executeTakeFirst();
      const total = Number(countResult?.count ?? 0);

      const members = await applyFilters(
        db.selectFrom("memberships as m")
          .leftJoin("users as u", "m.user_id", "u.id")
          .leftJoin("users as g", "m.granted_by", "g.id")
          .selectAll("m")
          .select([
            "u.name as user_name",
            "u.email as user_email",
            "u.avatar as user_avatar",
            "g.name as granter_name",
          ])
      )
        .orderBy("m.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

      return NextResponse.json({
        data: members,
        total,
        page,
        limit,
      });
    }

    if (action === "expiring") {
      // 即将到期的会员（可自定义天数）
      const days = parseInt(searchParams.get("days") || "7");
      const members = await db
        .selectFrom("memberships as m")
        .leftJoin("users as u", "m.user_id", "u.id")
        .selectAll("m")
        .select(["u.name as user_name", "u.email as user_email"])
        .where("m.status", "=", "active")
        .where("m.expires_at", ">=", sql<Date>`NOW()`)
        .where("m.expires_at", "<=", sql<Date>`DATE_ADD(NOW(), INTERVAL ${days} DAY)`)
        .orderBy("m.expires_at", "asc")
        .execute();

      return NextResponse.json({ data: members });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error: any) {
    console.error("GET /api/admin/membership error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/membership - 给用户发放会员
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const operatorId = (session.user as any).id;
    const body = await request.json();
    const { userId, plan, durationDays, note } = body;

    // 验证参数
    if (!userId) {
      return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
    }
    if (!["monthly", "yearly"].includes(plan)) {
      return NextResponse.json({ error: "无效的套餐类型" }, { status: 400 });
    }

    const days = durationDays || (plan === "monthly" ? 30 : 365);
    if (days < 1 || days > 3650) {
      return NextResponse.json({ error: "有效天数范围：1-3650" }, { status: 400 });
    }

    // 验证用户存在
    const users = await db
      .selectFrom("users")
      .select(["id", "name"])
      .where("id", "=", userId)
      .execute();
    if (users.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 发放会员（事务）
    const result = await db.transaction().execute(async (trx) => {
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
      endDate.setDate(endDate.getDate() + days);

      // 更新或创建会员记录
      await sql`
        INSERT INTO memberships (user_id, plan, started_at, expires_at, status, source, granted_by)
        VALUES (${userId}, ${plan}, ${startDate}, ${endDate}, 'active', 'admin_grant', ${operatorId})
        ON DUPLICATE KEY UPDATE plan = ${plan}, started_at = ${startDate}, expires_at = ${endDate}, status = 'active', source = 'admin_grant', granted_by = ${operatorId}
      `.execute(trx);

      // 获取会员ID
      const membershipRows = await trx
        .selectFrom("memberships")
        .select("id")
        .where("user_id", "=", userId)
        .execute();

      // 发送通知给用户
      await sql`
        INSERT INTO notifications (user_id, type, title, content)
        VALUES (${userId}, ${"membership_granted"}, ${"会员已发放"}, ${`管理员已为您发放${plan === "monthly" ? "月度" : "年度"}会员，有效期${days}天，到期时间：${endDate.toLocaleDateString("zh-CN")}`})
      `.execute(trx);

      return { membershipId: membershipRows[0]?.id, expiresAt: endDate };
    });

    // 记录操作日志
    await db.insertInto("admin_operation_logs").values({
      operator_id: operatorId,
      target_user_id: userId,
      operation: "grant_membership",
      detail: JSON.stringify({ plan, durationDays: days, note, expiresAt: result.expiresAt }),
    }).execute();

    return NextResponse.json({
      success: true,
      membershipId: result.membershipId,
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    console.error("POST /api/admin/membership error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
