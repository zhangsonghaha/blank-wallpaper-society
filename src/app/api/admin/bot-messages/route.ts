import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/bot-messages - 获取机器人消息留痕
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const botConfigId = searchParams.get("bot_config_id");
    const direction = searchParams.get("direction");
    const eventType = searchParams.get("event_type");
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("page_size") || "20", 10);
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions: string[] = [];
    const params: any[] = [];

    if (botConfigId) {
      conditions.push("bm.bot_config_id = ?");
      params.push(botConfigId);
    }
    if (direction && (direction === "outbound" || direction === "inbound")) {
      conditions.push("bm.direction = ?");
      params.push(direction);
    }
    if (eventType) {
      conditions.push("bm.event_type = ?");
      params.push(eventType);
    }
    if (platform) {
      conditions.push("bm.platform = ?");
      params.push(platform);
    }
    if (status && (status === "success" || status === "failed")) {
      conditions.push("bm.status = ?");
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 查询总数
    const countResult = (await query(
      `SELECT COUNT(*) as total FROM bot_messages bm ${whereClause}`,
      params
    )) as any[];
    const total = countResult[0]?.total || 0;

    // 查询消息列表（关联机器人名称）
    const messages = (await query(
      `SELECT bm.*, bc.name as bot_name
       FROM bot_messages bm
       LEFT JOIN bot_configs bc ON bm.bot_config_id = bc.id
       ${whereClause}
       ORDER BY bm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )) as any[];

    return NextResponse.json({
      messages,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}