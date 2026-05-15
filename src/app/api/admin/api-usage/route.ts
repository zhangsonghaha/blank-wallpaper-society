import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
        query("SELECT COUNT(*) as count FROM api_keys"),
        query("SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1"),
        query("SELECT COUNT(*) as count FROM api_usage_logs WHERE created_at >= CURDATE()"),
        query("SELECT COUNT(*) as count FROM api_usage_logs WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)"),
      ]);

      // 套餐分布
      const tierDistribution = await query(
        "SELECT tier, COUNT(*) as count FROM api_keys GROUP BY tier"
      );

      // 热门API Key（按调用量排名）
      const topKeys = await query(
        `SELECT k.id, k.key_prefix, k.name, k.tier, k.rate_limit, k.is_active, k.user_id, u.name as user_name,
                COUNT(l.id) as call_count
         FROM api_keys k
         LEFT JOIN api_usage_logs l ON k.id = l.api_key_id AND l.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         LEFT JOIN users u ON k.user_id = u.id
         GROUP BY k.id
         ORDER BY call_count DESC
         LIMIT 10`
      );

      return NextResponse.json({
        data: {
          totalKeys: (totalKeys as any[])[0]?.count || 0,
          activeKeys: (activeKeys as any[])[0]?.count || 0,
          totalCallsToday: (totalCallsToday as any[])[0]?.count || 0,
          totalCalls7d: (totalCalls7d as any[])[0]?.count || 0,
          tierDistribution,
          topKeys,
          tiers: API_TIERS,
        },
      });
    }

    if (action === "hourly") {
      // 24小时调用量趋势
      const hourly = await query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour, COUNT(*) as count,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
         FROM api_usage_logs
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         GROUP BY hour ORDER BY hour`
      );
      return NextResponse.json({ data: hourly });
    }

    if (action === "key-detail") {
      // 单个Key的详细信息
      const keyId = searchParams.get("keyId");
      if (!keyId) {
        return NextResponse.json({ error: "缺少keyId参数" }, { status: 400 });
      }

      const keyInfo = await query(
        `SELECT k.*, u.name as user_name, u.email as user_email
         FROM api_keys k
         LEFT JOIN users u ON k.user_id = u.id
         WHERE k.id = ?`,
        [keyId]
      );

      const usageLogs = await query(
        `SELECT endpoint, status_code, ip_address, created_at
         FROM api_usage_logs
         WHERE api_key_id = ?
         ORDER BY created_at DESC LIMIT 50`,
        [keyId]
      );

      return NextResponse.json({
        data: {
          key: (keyInfo as any[])[0] || null,
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

    const updates: string[] = [];
    const values: any[] = [];

    if (tier && API_TIERS[tier as keyof typeof API_TIERS]) {
      updates.push("tier = ?");
      values.push(tier);
      // 同时更新rate_limit为套餐默认值
      updates.push("rate_limit = ?");
      values.push(API_TIERS[tier as keyof typeof API_TIERS].rateLimit);
    }

    if (rateLimit !== undefined) {
      updates.push("rate_limit = ?");
      values.push(rateLimit);
    }

    if (isActive !== undefined) {
      updates.push("is_active = ?");
      values.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    values.push(keyId);
    await query(
      `UPDATE api_keys SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    return NextResponse.json({ message: "API Key更新成功" });
  } catch (error: any) {
    console.error("PATCH /api/admin/api-usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}