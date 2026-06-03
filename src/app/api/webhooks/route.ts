import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { WEBHOOK_EVENTS } from "@/lib/webhook";
import { sql } from "kysely";

// GET /api/webhooks - 获取当前用户的 Webhook 订阅
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const rows = await db
      .selectFrom("webhook_subscriptions")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();

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
    const countRow = await db
      .selectFrom("webhook_subscriptions")
      .select((eb) => [eb.fn.count<number>("id").as("cnt")])
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (Number(countRow?.cnt ?? 0) >= 10) {
      return NextResponse.json(
        { error: "最多创建 10 个 Webhook 订阅" },
        { status: 400 }
      );
    }

    const result = await db
      .insertInto("webhook_subscriptions")
      .values({
        user_id: userId,
        url,
        events: JSON.stringify(events),
        secret: secret || null,
        max_retries: max_retries || 3,
        retry_interval: retry_interval || 60,
        timeout_ms: timeout_ms || 5000,
      })
      .executeTakeFirst();

    return NextResponse.json({
      message: "Webhook 订阅已创建",
      id: Number(result.insertId),
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
    const existing = await db
      .selectFrom("webhook_subscriptions")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .execute();
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

    // Build update object with COALESCE-like behavior
    const updateObj: Record<string, any> = {};
    if (url) updateObj.url = url;
    if (events) updateObj.events = JSON.stringify(events);
    if (secret !== undefined) updateObj.secret = secret;
    if (enabled !== undefined) updateObj.enabled = enabled ? 1 : 0;
    if (max_retries) updateObj.max_retries = max_retries;
    if (retry_interval) updateObj.retry_interval = retry_interval;
    if (timeout_ms) updateObj.timeout_ms = timeout_ms;

    if (Object.keys(updateObj).length > 0) {
      await db
        .updateTable("webhook_subscriptions")
        .set(updateObj)
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
    }

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

    const result = await db
      .deleteFrom("webhook_subscriptions")
      .where("id", "=", parseInt(id))
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (Number(result.numDeletedRows) === 0) {
      return NextResponse.json({ error: "订阅不存在" }, { status: 404 });
    }

    return NextResponse.json({ message: "Webhook 订阅已删除" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
