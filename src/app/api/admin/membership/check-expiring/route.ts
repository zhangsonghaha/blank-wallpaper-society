import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// POST /api/admin/membership/check-expiring - 手动触发到期检查并通知
// 也可以通过 cron 调用
export async function POST(request: NextRequest) {
  try {
    // 允许管理员手动触发，也支持通过 cron secret 调用
    const session = await auth();
    const isAdmin = session?.user && (session.user as any).role === "admin";
    
    if (!isAdmin) {
      // 检查 cron secret
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "无权访问" }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const days = body.days || 7; // 提前几天通知

    // 1. 标记已过期的会员
    const expiredCount = await db
      .updateTable("memberships")
      .set({ status: "expired" })
      .where("status", "=", "active")
      .where("expires_at", "<=", sql<Date>`NOW()`)
      .execute();

    // 2. 查找即将到期的会员（未被通知过的）
    // 使用通知记录来避免重复通知：如果用户在过去24小时内已收到过到期提醒，则跳过
    const expiringMembers = await sql`
      SELECT m.id, m.user_id, m.plan, m.expires_at, u.name as user_name, u.email as user_email
      FROM memberships m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.status = 'active'
        AND m.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ${days} DAY)
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = m.user_id
            AND n.type = 'membership_expiring'
            AND n.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        )
      ORDER BY m.expires_at ASC
    `.execute(db);

    const rows = (expiringMembers as any).rows ?? [];

    // 3. 发送到期提醒通知
    let notifiedCount = 0;
    for (const member of rows) {
      const daysLeft = Math.ceil(
        (new Date(member.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      const planLabel = member.plan === "monthly" ? "月度" : "年度";
      
      await sql`
        INSERT INTO notifications (user_id, type, title, content)
        VALUES (${member.user_id}, ${"membership_expiring"}, ${"会员即将到期"}, ${`您的${planLabel}会员将在${daysLeft}天后到期（${new Date(member.expires_at).toLocaleDateString("zh-CN")}），届时将无法享受会员专属功能。如需续费，请前往会员中心。`})
      `.execute(db);
      notifiedCount++;
    }

    return NextResponse.json({
      success: true,
      expiredCount,
      expiringCount: rows.length,
      notifiedCount,
    });
  } catch (error: any) {
    console.error("POST /api/admin/membership/check-expiring error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
