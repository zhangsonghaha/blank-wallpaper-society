/**
 * Webhook 事件投递库
 * 支持用户订阅事件，通过 HTTP POST 将事件数据推送到指定 URL
 * 包含签名验证、重试机制、投递日志
 */

import { db } from "@/lib/db";
import { sql } from "kysely";
import crypto from "crypto";

// === 事件类型定义 ===

export type WebhookEvent =
  | "image.uploaded"
  | "image.approved"
  | "image.rejected"
  | "image.deleted"
  | "comment.created"
  | "comment.deleted"
  | "user.registered"
  | "user.followed"
  | "user.levelup"
  | "achievement.unlocked"
  | "collection.created"
  | "order.created"
  | "order.completed";

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "image.uploaded": "图片上传",
  "image.approved": "图片审核通过",
  "image.rejected": "图片审核拒绝",
  "image.deleted": "图片删除",
  "comment.created": "评论创建",
  "comment.deleted": "评论删除",
  "user.registered": "用户注册",
  "user.followed": "用户关注",
  "user.levelup": "用户升级",
  "achievement.unlocked": "成就解锁",
  "collection.created": "合集创建",
  "order.created": "订单创建",
  "order.completed": "订单完成",
};

export const WEBHOOK_EVENTS = Object.keys(WEBHOOK_EVENT_LABELS) as WebhookEvent[];

// === Webhook 投递接口 ===

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WebhookSubscription {
  id: number;
  user_id: number;
  url: string;
  events: WebhookEvent[];
  secret: string | null;
  enabled: number;
  max_retries: number;
  retry_interval: number;
  timeout_ms: number;
  last_delivered_at: string | null;
  delivery_count: number;
  fail_count: number;
  created_at: string;
  updated_at: string;
}

// === 签名生成 ===

/**
 * 生成 HMAC-SHA256 签名
 * 签名内容为 payload JSON + timestamp
 */
function generateSignature(payload: string, secret: string, timestamp: string): string {
  const signatureBase = `${timestamp}.${payload}`;
  return crypto
    .createHmac("sha256", secret)
    .update(signatureBase)
    .digest("hex");
}

// === 投递方法 ===

/**
 * 投递事件到指定 Webhook URL
 */
async function deliverWebhook(
  subscription: WebhookSubscription,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadStr = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": event,
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Delivery": crypto.randomUUID(),
  };

  if (subscription.secret) {
    headers["X-Webhook-Signature"] = generateSignature(
      payloadStr,
      subscription.secret,
      timestamp
    );
    headers["X-Webhook-Signature-Algorithm"] = "hmac-sha256";
  }

  try {
    const response = await fetch(subscription.url, {
      method: "POST",
      headers,
      body: payloadStr,
      signal: AbortSignal.timeout(subscription.timeout_ms || 5000),
    });

    const responseBody = await response.text().catch(() => "");

    return {
      success: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "请求失败",
    };
  }
}

/**
 * 记录投递日志
 */
async function logDelivery(
  subscriptionId: number,
  event: WebhookEvent,
  payload: Record<string, unknown>,
  statusCode: number | undefined,
  responseBody: string | undefined,
  attempt: number,
  success: boolean
): Promise<void> {
  await db.insertInto("webhook_delivery_logs")
    .values({
      subscription_id: subscriptionId,
      event,
      payload: JSON.stringify(payload),
      response_status: statusCode || null,
      response_body: responseBody ? responseBody.slice(0, 1000) : null,
      attempt,
      success: success ? 1 : 0,
      delivered_at: success ? new Date() : null,
    })
    .execute();
}

// === 核心方法 ===

/**
 * 触发 Webhook 事件（向所有订阅者投递）
 */
export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const rows = await db.selectFrom("webhook_subscriptions")
      .where("enabled", "=", 1)
      .selectAll()
      .execute();

    for (const row of rows) {
      const subscription: WebhookSubscription = {
        ...row,
        events: typeof row.events === "string" ? JSON.parse(row.events) : row.events,
        max_retries: row.max_retries ?? 3,
        retry_interval: row.retry_interval ?? 60,
        timeout_ms: row.timeout_ms ?? 5000,
        delivery_count: row.delivery_count ?? 0,
        fail_count: row.fail_count ?? 0,
        last_delivered_at: row.last_delivered_at ? row.last_delivered_at.toISOString() : null,
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
      };

      // 检查事件订阅
      if (!subscription.events.includes(event)) {
        continue;
      }

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
      };

      // 尝试投递（含重试）
      let attempt = 0;
      let lastResult: { success: boolean; statusCode?: number; error?: string } | null = null;

      while (attempt < (subscription.max_retries || 3)) {
        attempt++;
        lastResult = await deliverWebhook(subscription, event, data);

        // 记录每次尝试
        await logDelivery(
          subscription.id,
          event,
          { event, timestamp: payload.timestamp, data },
          lastResult.statusCode,
          lastResult.error,
          attempt,
          lastResult.success
        );

        if (lastResult.success) {
          break;
        }

        // 重试间隔（不阻塞，仅等待后继续）
        if (attempt < (subscription.max_retries || 3)) {
          await new Promise((resolve) =>
            setTimeout(resolve, (subscription.retry_interval || 60) * 1000)
          );
        }
      }

      // 更新订阅统计
      if (lastResult?.success) {
        await db.updateTable("webhook_subscriptions")
          .set({
            last_delivered_at: sql`NOW()`,
            delivery_count: sql`delivery_count + 1`,
          })
          .where("id", "=", subscription.id)
          .execute();
      } else {
        await db.updateTable("webhook_subscriptions")
          .set({ fail_count: sql`fail_count + 1` })
          .where("id", "=", subscription.id)
          .execute();
      }
    }
  } catch (error) {
    console.error("[Webhook] triggerWebhook error:", error);
  }
}

/**
 * 异步触发 Webhook（不阻塞主流程）
 */
export function triggerWebhookAsync(
  event: WebhookEvent,
  data: Record<string, unknown>
): void {
  triggerWebhook(event, data).catch((err) => {
    console.error("[Webhook] 异步投递失败:", err);
  });
}

// === 验证 Webhook 签名（供消费者使用） ===

/**
 * 验证 Webhook 签名
 * 使用方可在接收端调用此方法验证请求来源
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  timestamp: string,
  signature: string
): boolean {
  const expectedSignature = generateSignature(payload, secret, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}