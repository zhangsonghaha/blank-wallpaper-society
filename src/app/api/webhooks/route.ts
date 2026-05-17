import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { WEBHOOK_EVENTS } from "@/lib/webhook";

// GET /api/webhooks - 获取当前用户的 Webhook 订阅
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const rows = (await query(
      "SELECT * FROM webhook_subscriptions WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    )) as any[];

    const subscriptions = rows.map((row: any) => ({
      ...row,
      events: typeof row.events === "string" ? JSON.parse(row.events) : row.events,
    }));

    return NextResponse.json({ subscriptions, availableEvents: WEBHOOK_EVENTS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/webhooks - 创建 Webhook 订阅
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { url, events, secret, max_retries, retry_interval, timeout_ms } = await request.json();

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "URL 和事件列表为必填项" },
        { status: 400 }
      );
    }

    // 验证事件类型
    const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `不支持的事件类型: ${invalidEvents.join(", ")}` },
        { status: 400 }
      );
    }

    // 限制每个用户最多 10 个订阅
    const count = (await query(
      "SELECT COUNT(*) as cnt FROM webhook_subscriptions WHERE user_id = ?",
      [userId]
    )) as any[];
    if (count[0]?.cnt >= 10) {
      return NextResponse.json(
        { error: "最多创建 10 个 Webhook 订阅" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO webhook_subscriptions (user_id, url, events, secret, max_retries, retry_interval, timeout_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        url,
        JSON.stringify(events),
        secret || null,
        max_retries || 3,
        retry_interval || 60,
        timeout_ms || 5000,
      ]
    );

    return NextResponse.json({
      message: "Webhook 订阅已创建",
      id: (result as any).insertId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/webhooks - 更新 Webhook 订阅
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id, url, events, secret, enabled, max_retries, retry_interval, timeout_ms } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "缺少订阅ID" }, { status: 400 });
    }

    // 验证所有权
    const existing = (await query(
      "SELECT id FROM webhook_subscriptions WHERE id = ? AND user_id = ?",
      [id, userId]
    )) as any[];
    if (existing.length === 0) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 });
    }

    // 验证事件类型
    if (events) {
      const invalidEvents = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e as any));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `不支持的事件类型: ${invalidEvents.join(", ")}` },
          { status: 400 }
        );
      }
    }

    await query(
      `UPDATE webhook_subscriptions SET
        url = COALESCE(?, url),
        events = COALESCE(?, events),
        secret = COALESCE(?, secret),
        enabled = COALESCE(?, enabled),
        max_retries = COALESCE(?, max_retries),
        retry_interval = COALESCE(?, retry_interval),
        timeout_ms = COALESCE(?, timeout_ms)
       WHERE id = ? AND user_id = ?`,
      [
        url || null,
        events ? JSON.stringify(events) : null,
        secret !== undefined ? secret : null,
        enabled !== undefined ? enabled : null,
        max_retries || null,
        retry_interval || null,
        timeout_ms || null,
        id,
        userId,
      ]
    );

    return NextResponse.json({ message: "Webhook 订阅已更新" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/webhooks - 删除 Webhook 订阅
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少订阅ID" }, { status: 400 });
    }

    const result = await query(
      "DELETE FROM webhook_subscriptions WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 });
    }

    return NextResponse.json({ message: "Webhook 订阅已删除" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}