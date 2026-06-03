import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

    // 构建查询条件（使用 $if 动态构建）
    const applyFilters = (qb: any) =>
      qb
        .$if(!!botConfigId, (q: any) => q.where("bm.bot_config_id", "=", Number(botConfigId)))
        .$if(!!direction && (direction === "outbound" || direction === "inbound"), (q: any) => q.where("bm.direction", "=", direction))
        .$if(!!eventType, (q: any) => q.where("bm.event_type", "=", eventType))
        .$if(!!platform, (q: any) => q.where("bm.platform", "=", platform))
        .$if(!!status && (status === "success" || status === "failed"), (q: any) => q.where("bm.status", "=", status));

    // 查询总数
    const countResult = await applyFilters(
      db.selectFrom("bot_messages as bm").select((eb) => eb.fn.countAll().as("total"))
    ).executeTakeFirst();
    const total = Number(countResult?.total ?? 0);

    // 查询消息列表（关联机器人名称）
    const messages = await applyFilters(
      db.selectFrom("bot_messages as bm")
        .leftJoin("bot_configs as bc", "bm.bot_config_id", "bc.id")
        .select((eb) => [
          "bm.id",
          "bm.bot_config_id",
          "bm.chat_id",
          "bm.content",
          "bm.created_at",
          "bm.direction",
          "bm.error_message",
          "bm.event_type",
          "bm.message_type",
          "bm.platform",
          "bm.sender_id",
          "bm.sender_name",
          "bm.status",
          "bm.title",
          "bc.name as bot_name",
        ])
    )
      .orderBy("bm.created_at", "desc")
      .limit(pageSize)
      .offset(offset)
      .execute();

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
