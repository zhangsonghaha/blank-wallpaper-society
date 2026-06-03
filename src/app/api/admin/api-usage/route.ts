import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { API_TIERS } from "@/lib/rate-limit";

// GET /api/admin/api-usage - 获取API用量统计概览
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "overview") {
      // 总体概览
      const [totalKeys, activeKeys, totalCallsToday, totalCalls7d] = await Promise.all([
        db.selectFrom("api_keys").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
        db.selectFrom("api_keys").where("is_active", "=", 1).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
        db.selectFrom("api_usage_logs").where("created_at", ">=", sql<Date>`CURDATE()`).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
        db.selectFrom("api_usage_logs").where("created_at", ">=", sql<Date>`DATE_SUB(CURDATE(), INTERVAL 7 DAY)`).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
      ]);

      // 套餐分布
      const tierDistribution = await db.selectFrom("api_keys")
        .select((eb) => ["tier", eb.fn.countAll().as("count")])
        .groupBy("tier")
        .execute();

      // 热门API Key（按调用量排名）
      const topKeys = await sql<{
        id: number; key_prefix: string; name: string; tier: string; rate_limit: number;
        is_active: number; user_id: number; user_name: string; call_count: string | number;
      }>`SELECT k.id, k.key_prefix, k.name, k.tier, k.rate_limit, k.is_active, k.user_id, u.name as user_name,
                COUNT(l.id) as call_count
         FROM api_keys k
         LEFT JOIN api_usage_logs l ON k.id = l.api_key_id AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         LEFT JOIN users u ON k.user_id = u.id
         GROUP BY k.id
         ORDER BY call_count DESC
         LIMIT 10`.execute(db);

      return NextResponse.json({
        data: {
          totalKeys: Number(totalKeys?.count || 0),
          activeKeys: Number(activeKeys?.count || 0),
          totalCallsToday: Number(totalCallsToday?.count || 0),
          totalCalls7d: Number(totalCalls7d?.count || 0),
          tierDistribution,
          topKeys: topKeys.rows,
          tiers: API_TIERS,
        },
      });
    }

    if (action === "hourly") {
      // 24小时调用量趋势
      const hourly = await sql<{ hour: string; count: string | number; errors: string | number }>`SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour, COUNT(*) as count,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
         FROM api_usage_logs
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         GROUP BY hour ORDER BY hour`.execute(db);
      return NextResponse.json({ data: hourly.rows });
    }

    if (action === "key-detail") {
      // 单个Key的详细信息
      const keyId = searchParams.get("keyId");
      if (!keyId) {
        return NextResponse.json({ error: "缺少keyId参数" }, { status: 400 });
      }

      const keyInfo = await sql<{
        id: number; key_prefix: string; name: string; tier: string; rate_limit: number;
        is_active: number; user_id: number; user_name: string; user_email: string;
        created_at: string;
      }>`SELECT k.*, u.name as user_name, u.email as user_email
         FROM api_keys k
         LEFT JOIN users u ON k.user_id = u.id
         WHERE k.id = ${Number(keyId)}`.execute(db);

      const usageLogs = await db.selectFrom("api_usage_logs")
        .where("api_key_id", "=", Number(keyId))
        .select(["endpoint", "status_code", "ip_address", "created_at"])
        .orderBy("created_at", "desc")
        .limit(50)
        .execute();

      return NextResponse.json({
        data: {
          key: keyInfo.rows[0] || null,
          recentLogs: usageLogs,
        },
      });
    }

    // 默认返回概览
    return NextResponse.json({ error: "请指定action参数: overview/hourly/key-detail" }, { status: 400 });
  } catch (error: any) {
    console.error("GET /api/admin/api-usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/api-usage - 更新API Key套餐/限流
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { keyId, tier, rateLimit, isActive } = body;

    if (!keyId) {
      return NextResponse.json({ error: "缺少keyId参数" }, { status: 400 });
    }

    const updates: Record<string, any> = {};

    if (tier && API_TIERS[tier as keyof typeof API_TIERS]) {
      updates.tier = tier;
      updates.rate_limit = API_TIERS[tier as keyof typeof API_TIERS].rateLimit;
    }

    if (rateLimit !== undefined) {
      updates.rate_limit = rateLimit;
    }

    if (isActive !== undefined) {
      updates.is_active = isActive ? 1 : 0;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    await db.updateTable("api_keys")
      .set(updates)
      .where("id", "=", Number(keyId))
      .execute();

    return NextResponse.json({ message: "API Key更新成功" });
  } catch (error: any) {
    console.error("PATCH /api/admin/api-usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
