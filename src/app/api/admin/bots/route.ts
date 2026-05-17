import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import { clearBotConfigCache, testBotNotification } from "@/lib/bot-notification";
import { validateRequestBody, botConfigSchema } from "@/lib/api-schemas";

// GET /api/admin/bots - 获取所有机器人配置
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const rows = (await query(
      "SELECT * FROM bot_configs ORDER BY created_at DESC"
    )) as any[];

    // 解析 JSON 字段
    const configs = rows.map((row: any) => ({
      ...row,
      subscribe_events: row.subscribe_events
        ? typeof row.subscribe_events === "string"
          ? JSON.parse(row.subscribe_events)
          : row.subscribe_events
        : null,
      custom_headers: row.custom_headers
        ? typeof row.custom_headers === "string"
          ? JSON.parse(row.custom_headers)
          : row.custom_headers
        : null,
    }));

    return NextResponse.json(configs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/bots - 新增机器人配置
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const rawBody = await request.json();

    // Zod Schema 验证
    const validation = validateRequestBody(botConfigSchema, rawBody);
    if ("error" in validation) {
      return NextResponse.json({ error: "参数验证失败", details: validation.error }, { status: 400 });
    }
    const {
      name,
      type,
      auth_mode,
      app_id,
      app_secret,
      chat_id,
      webhook_url,
      secret,
      enabled,
      subscribe_events,
      feishu_msg_type,
      qq_group_id,
      custom_method,
      custom_headers,
      custom_body_template,
    } = validation.data;

    const result = await query(
      `INSERT INTO bot_configs (name, type, auth_mode, app_id, app_secret, chat_id, webhook_url, secret, enabled, subscribe_events, feishu_msg_type, qq_group_id, custom_method, custom_headers, custom_body_template)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        type,
        auth_mode || "webhook",
        app_id || null,
        app_secret || null,
        chat_id || null,
        webhook_url || "",
        secret || null,
        enabled !== undefined ? enabled : 1,
        subscribe_events ? JSON.stringify(subscribe_events) : null,
        feishu_msg_type || "interactive",
        qq_group_id || null,
        custom_method || "POST",
        custom_headers ? JSON.stringify(custom_headers) : null,
        custom_body_template || null,
      ]
    );

    clearBotConfigCache();

    // 审计日志
    const adminId = (session.user as any).id;
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    logAudit({
      operatorId: adminId,
      operation: "bot_config_create",
      detail: { name, type, webhook_url },
      ip: clientIp?.split(",")[0]?.trim(),
    }).catch(() => {});

    return NextResponse.json({
      message: "机器人配置已创建",
      id: (result as any).insertId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/bots - 更新机器人配置
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      name,
      type,
      auth_mode,
      app_id,
      app_secret,
      chat_id,
      webhook_url,
      secret,
      enabled,
      subscribe_events,
      feishu_msg_type,
      qq_group_id,
      custom_method,
      custom_headers,
      custom_body_template,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少机器人ID" }, { status: 400 });
    }

    // 检查是否存在
    const existing = (await query("SELECT id FROM bot_configs WHERE id = ?", [
      id,
    ])) as any[];
    if (existing.length === 0) {
      return NextResponse.json({ error: "机器人配置不存在" }, { status: 404 });
    }

    await query(
      `UPDATE bot_configs SET
        name = ?, type = ?, auth_mode = ?, app_id = ?, app_secret = ?, chat_id = ?,
        webhook_url = ?, secret = ?, enabled = ?,
        subscribe_events = ?, feishu_msg_type = ?, qq_group_id = ?,
        custom_method = ?, custom_headers = ?, custom_body_template = ?
       WHERE id = ?`,
      [
        name,
        type,
        auth_mode || "webhook",
        app_id || null,
        app_secret || null,
        chat_id || null,
        webhook_url || "",
        secret || null,
        enabled !== undefined ? enabled : 1,
        subscribe_events ? JSON.stringify(subscribe_events) : null,
        feishu_msg_type || "interactive",
        qq_group_id || null,
        custom_method || "POST",
        custom_headers ? JSON.stringify(custom_headers) : null,
        custom_body_template || null,
        id,
      ]
    );

    clearBotConfigCache();

    // 审计日志
    const adminId = (session.user as any).id;
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    logAudit({
      operatorId: adminId,
      operation: "bot_config_update",
      detail: { id, name, type },
      ip: clientIp?.split(",")[0]?.trim(),
    }).catch(() => {});

    return NextResponse.json({ message: "机器人配置已更新" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/bots - 删除机器人配置
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少机器人ID" }, { status: 400 });
    }

    const result = await query("DELETE FROM bot_configs WHERE id = ?", [id]);
    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "机器人配置不存在" }, { status: 404 });
    }

    clearBotConfigCache();

    // 审计日志
    const adminId = (session.user as any).id;
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    logAudit({
      operatorId: adminId,
      operation: "bot_config_delete",
      detail: { id: Number(id) },
      ip: clientIp?.split(",")[0]?.trim(),
    }).catch(() => {});

    return NextResponse.json({ message: "机器人配置已删除" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}