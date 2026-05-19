import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";
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
      const [activeCount, expiringCount, totalMembers, planDistribution, recentGrants] = await Promise.all([
        // 活跃会员数
        query("SELECT COUNT(*) as count FROM memberships WHERE status = 'active' AND expires_at > NOW()") as any,
        // 即将到期（7天内）
        query("SELECT COUNT(*) as count FROM memberships WHERE status = 'active' AND expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)") as any,
        // 总会员数（含过期）
        query("SELECT COUNT(*) as count FROM memberships") as any,
        // 套餐分布
        query("SELECT plan, COUNT(*) as count FROM memberships WHERE status = 'active' AND expires_at > NOW() GROUP BY plan") as any,
        // 最近发放记录
        query(`SELECT m.*, u.name as user_name, g.name as granter_name
               FROM memberships m
               LEFT JOIN users u ON m.user_id = u.id
               LEFT JOIN users g ON m.granted_by = g.id
               WHERE m.source IN ('admin_grant', 'redeem_code')
               ORDER BY m.created_at DESC LIMIT 10`) as any,
      ]);

      return NextResponse.json({
        stats: {
          activeCount: activeCount[0]?.count || 0,
          expiringCount: expiringCount[0]?.count || 0,
          totalMembers: totalMembers[0]?.count || 0,
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

      const conditions: string[] = [];
      const params: any[] = [];

      if (search) {
        conditions.push("(u.name LIKE ? OR u.email LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
      if (planFilter) {
        conditions.push("m.plan = ?");
        params.push(planFilter);
      }
      if (statusFilter === "active") {
        conditions.push("m.status = 'active' AND m.expires_at > NOW()");
      } else if (statusFilter === "expired") {
        conditions.push("(m.status = 'expired' OR m.expires_at <= NOW())");
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countResult = await query(
        `SELECT COUNT(*) as count FROM memberships m LEFT JOIN users u ON m.user_id = u.id ${whereClause}`,
        params
      ) as any[];

      const members = await query(
        `SELECT m.*, u.name as user_name, u.email as user_email, u.avatar as user_avatar,
                g.name as granter_name
         FROM memberships m
         LEFT JOIN users u ON m.user_id = u.id
         LEFT JOIN users g ON m.granted_by = g.id
         ${whereClause}
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ) as any[];

      return NextResponse.json({
        data: members,
        total: countResult[0]?.count || 0,
        page,
        limit,
      });
    }

    if (action === "expiring") {
      // 即将到期的会员（可自定义天数）
      const days = parseInt(searchParams.get("days") || "7");
      const members = await query(
        `SELECT m.*, u.name as user_name, u.email as user_email
         FROM memberships m
         LEFT JOIN users u ON m.user_id = u.id
         WHERE m.status = 'active' AND m.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
         ORDER BY m.expires_at ASC`,
        [days]
      ) as any[];

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
    const users = await query("SELECT id, name FROM users WHERE id = ?", [userId]) as any[];
    if (users.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 发放会员（事务）
    const result = await withTransaction(async (conn) => {
      // 检查是否已有有效会员
      const [existing] = await conn.execute(
        "SELECT id, expires_at FROM memberships WHERE user_id = ? AND status = 'active'",
        [userId]
      ) as [any[], any];

      let startDate = new Date();
      if (existing.length > 0 && new Date(existing[0].expires_at) > startDate) {
        startDate = new Date(existing[0].expires_at); // 从当前到期日续期
      }

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + days);

      // 更新或创建会员记录
      await conn.execute(
        `INSERT INTO memberships (user_id, plan, started_at, expires_at, status, source, granted_by)
         VALUES (?, ?, ?, ?, 'active', 'admin_grant', ?)
         ON DUPLICATE KEY UPDATE plan = ?, started_at = ?, expires_at = ?, status = 'active', source = 'admin_grant', granted_by = ?`,
        [userId, plan, startDate, endDate, operatorId, plan, startDate, endDate, operatorId]
      );

      // 获取会员ID
      const [membershipRows] = await conn.execute(
        "SELECT id FROM memberships WHERE user_id = ?",
        [userId]
      ) as [any[], any];

      // 发送通知给用户
      await conn.execute(
        `INSERT INTO notifications (user_id, type, title, content)
         VALUES (?, 'membership_granted', ?, ?)`,
        [
          userId,
          "会员已发放",
          `管理员已为您发放${plan === "monthly" ? "月度" : "年度"}会员，有效期${days}天，到期时间：${endDate.toLocaleDateString("zh-CN")}`,
        ]
      );

      return { membershipId: membershipRows[0]?.id, expiresAt: endDate };
    });

    // 记录操作日志
    await query(
      "INSERT INTO admin_operation_logs (operator_id, target_user_id, operation, detail) VALUES (?, ?, ?, ?)",
      [
        operatorId,
        userId,
        "grant_membership",
        JSON.stringify({ plan, durationDays: days, note, expiresAt: result.expiresAt }),
      ]
    );

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