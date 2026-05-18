/**
 * 机器人通知库
 * 支持两种认证模式：
 *   1. webhook — 群自定义机器人 Webhook（简单，单向推送）
 *   2. app — 开放平台 App ID + App Secret（完整，支持指定群发消息）
 * 
 * 支持平台：飞书、QQ、钉钉、企业微信、Slack、自定义
 * 配置存储在 bot_configs 表，支持按事件类型订阅
 */

import { query } from "@/lib/db";
import crypto from "crypto";

// === 类型定义 ===

export type BotType = "feishu" | "qq" | "dingtalk" | "wechat_work" | "slack" | "custom";
export type AuthMode = "webhook" | "app";
export type NotificationEventType = "system" | "like" | "comment" | "review" | "follow" | "achievement" | "favorite" | "crawl" | "upload";

export const BOT_TYPE_LABELS: Record<BotType, string> = {
  feishu: "飞书", qq: "QQ", dingtalk: "钉钉", wechat_work: "企业微信", slack: "Slack", custom: "自定义",
};

export const BOT_TYPE_ICONS: Record<BotType, string> = {
  feishu: "🐦", qq: "🐧", dingtalk: "🔵", wechat_work: "💬", slack: "📱", custom: "🔗",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  system: "系统通知", like: "点赞", comment: "评论", review: "审核",
  follow: "关注", achievement: "成就", favorite: "收藏", crawl: "爬取", upload: "上传",
};

export interface BotConfig {
  id: number;
  name: string;
  type: BotType;
  auth_mode: AuthMode;
  app_id: string | null;
  app_secret: string | null;
  chat_id: string | null;
  webhook_url: string;
  secret: string | null;
  enabled: number;
  subscribe_events: string[] | null;
  feishu_msg_type: string;
  qq_group_id: string | null;
  custom_method: string;
  custom_headers: Record<string, string> | null;
  custom_body_template: string | null;
  last_sent_at: string | null;
  send_count: number;
  fail_count: number;
  created_at: string;
  updated_at: string;
}

// === 配置缓存 ===

let botConfigCache: { configs: BotConfig[]; expiresAt: number } | null = null;
const BOT_CONFIG_TTL = 2 * 60 * 1000;

export function clearBotConfigCache(): void {
  botConfigCache = null;
}

function parseJsonField(value: any): any {
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export async function getEnabledBotConfigs(): Promise<BotConfig[]> {
  if (botConfigCache && Date.now() < botConfigCache.expiresAt) {
    return botConfigCache.configs;
  }
  const rows = (await query("SELECT * FROM bot_configs WHERE enabled = 1")) as any[];
  const configs: BotConfig[] = rows.map((row: any) => ({
    ...row,
    subscribe_events: parseJsonField(row.subscribe_events),
    custom_headers: parseJsonField(row.custom_headers),
  }));
  botConfigCache = { configs, expiresAt: Date.now() + BOT_CONFIG_TTL };
  return configs;
}

// === Token 缓存 ===

interface TokenCache { token: string; expiresAt: number; }
const tokenCacheMap = new Map<number, TokenCache>();

function getCachedToken(botId: number): string | null {
  const cached = tokenCacheMap.get(botId);
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  tokenCacheMap.delete(botId);
  return null;
}

function setCachedToken(botId: number, token: string, expiresIn: number): void {
  tokenCacheMap.set(botId, { token, expiresAt: Date.now() + (expiresIn - 300) * 1000 });
}

// === 飞书：获取 tenant_access_token ===

async function getFeishuTenantAccessToken(appId: string, appSecret: string, botId: number): Promise<string | null> {
  const cached = getCachedToken(botId);
  if (cached) return cached;
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.code === 0 && data.tenant_access_token) {
      setCachedToken(botId, data.tenant_access_token, data.expire || 7200);
      return data.tenant_access_token;
    }
    console.error("[BotNotification] 获取飞书 tenant_access_token 失败:", data);
    return null;
  } catch (error) {
    console.error("[BotNotification] 获取飞书 tenant_access_token 异常:", error);
    return null;
  }
}

// === 飞书 App API：发送消息到群 ===

async function sendFeishuAppMessage(config: BotConfig, title: string, content: string, type: string): Promise<{ success: boolean; error?: string }> {
  const token = await getFeishuTenantAccessToken(config.app_id!, config.app_secret!, config.id);
  if (!token) return { success: false, error: "获取飞书 tenant_access_token 失败" };

  const typeLabel = EVENT_TYPE_LABELS[type] || type;
  let body: Record<string, unknown>;

  if (config.feishu_msg_type === "interactive") {
    body = {
      msg_type: "interactive",
      card: {
        header: { title: { tag: "plain_text", content: `【${typeLabel}】${title}` }, template: getFeishuHeaderColor(type) },
        elements: [
          { tag: "div", text: { tag: "plain_text", content: content || title } },
          { tag: "div", text: { tag: "plain_text", content: `⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` } },
        ],
      },
    };
  } else if (config.feishu_msg_type === "post") {
    body = { msg_type: "post", content: { post: { zh_cn: { title: `【${typeLabel}】${title}`, content: [[{ tag: "text", text: content }]] } } } };
  } else {
    body = { msg_type: "text", content: { text: `【${typeLabel}】${title}\n${content}` } };
  }

  try {
    const res = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ receive_id: config.chat_id, ...body }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.code === 0) return { success: true };
    return { success: false, error: `飞书API错误 ${data.code}: ${data.msg}` };
  } catch (error: any) {
    return { success: false, error: error.message || "发送失败" };
  }
}

// === QQ：获取 access_token ===

async function getQQAccessToken(appId: string, appSecret: string, botId: number): Promise<string | null> {
  const cached = getCachedToken(botId);
  if (cached) return cached;
  try {
    const res = await fetch("https://bots.qq.com/app/getAppAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, clientSecret: appSecret }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.access_token) {
      setCachedToken(botId, data.access_token, data.expires_in || 7200);
      return data.access_token;
    }
    console.error("[BotNotification] 获取QQ access_token 失败:", data);
    return null;
  } catch (error) {
    console.error("[BotNotification] 获取QQ access_token 异常:", error);
    return null;
  }
}

// === QQ App API：发送消息 ===

async function sendQQAppMessage(config: BotConfig, title: string, content: string, type: string): Promise<{ success: boolean; error?: string }> {
  const token = await getQQAccessToken(config.app_id!, config.app_secret!, config.id);
  if (!token) return { success: false, error: "获取QQ access_token 失败" };

  const typeLabel = EVENT_TYPE_LABELS[type] || type;
  try {
    const res = await fetch(`https://api.sgroup.qq.com/channels/${config.chat_id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `QQBot ${token}` },
      body: JSON.stringify({
        content: `【${typeLabel}】${title}\n${content || ""}\n\n⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
        msg_type: 0, msg_id: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { success: true };
    const errText = await res.text().catch(() => "");
    return { success: false, error: `QQ API ${res.status}: ${errText.slice(0, 200)}` };
  } catch (error: any) {
    return { success: false, error: error.message || "发送失败" };
  }
}

// === Webhook 消息构建方法 ===

function signFeishu(secret: string, timestamp: number): string {
  return crypto.createHmac("sha256", `${timestamp}\n${secret}`).digest("base64");
}

function getFeishuHeaderColor(type: string): string {
  return { system: "blue", review: "green", achievement: "gold", comment: "purple", follow: "turquoise", favorite: "yellow", like: "red", crawl: "indigo", upload: "violet" }[type] || "blue";
}

function buildFeishuWebhookMessage(title: string, content: string, type: string, config: BotConfig): Record<string, unknown> {
  const typeLabel = EVENT_TYPE_LABELS[type] || type;
  const ts = Math.floor(Date.now() / 1000);
  const card: Record<string, unknown> = { msg_type: config.feishu_msg_type || "interactive", timestamp: String(ts) };
  if (config.secret) card.sign = signFeishu(config.secret, ts);
  if (config.feishu_msg_type === "text") {
    card.content = { text: `【${typeLabel}】${title}\n${content}` };
  } else if (config.feishu_msg_type === "post") {
    card.content = { post: { zh_cn: { title: `【${typeLabel}】${title}`, content: [[{ tag: "text", text: content }]] } } };
  } else {
    card.card = {
      header: { title: { tag: "plain_text", content: `【${typeLabel}】${title}` }, template: getFeishuHeaderColor(type) },
      elements: [
        { tag: "div", text: { tag: "plain_text", content: content || title } },
        { tag: "div", text: { tag: "plain_text", content: `⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` } },
      ],
    };
  }
  return card;
}

function buildDingtalkMessage(title: string, content: string, type: string, config: BotConfig): Record<string, unknown> {
  const typeLabel = EVENT_TYPE_LABELS[type] || type;
  const ts = Date.now();
  const msg: Record<string, unknown> = {
    msgtype: "markdown",
    markdown: { title: `【${typeLabel}】${title}`, text: `### 【${typeLabel}】${title}\n\n${content || ""}\n\n---\n> ⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` },
  };
  if (config.secret) {
    msg.timestamp = String(ts);
    msg.sign = crypto.createHmac("sha256", config.secret).update(`${ts}\n${config.secret}`).digest("base64");
  }
  return msg;
}

function buildWechatWorkMessage(title: string, content: string, type: string): Record<string, unknown> {
  const typeLabel = EVENT_TYPE_LABELS[type] || type;
  return { msgtype: "markdown", markdown: { content: `### 【${typeLabel}】${title}\n> ${content || ""}\n\n⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` } };
}

function buildSlackMessage(title: string, content: string, type: string): Record<string, unknown> {
  const typeLabel = EVENT_TYPE_LABELS[type] || type;
  const emoji = { system: "🔔", review: "✅", achievement: "🏆", comment: "💬", follow: "👤", favorite: "⭐", like: "❤️", crawl: "🕷️", upload: "📤" }[type] || "📢";
  return {
    text: `${emoji} 【${typeLabel}】${title}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: `${emoji} 【${typeLabel}】${title}`, emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: content || title } },
      { type: "context", elements: [{ type: "mrkdwn", text: `⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` }] },
    ],
  };
}

function buildCustomMessage(title: string, content: string, type: string, config: BotConfig): { body: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(config.custom_headers || {}) };
  let body: string;
  if (config.custom_body_template) {
    body = config.custom_body_template.replace(/\{\{title\}\}/g, title).replace(/\{\{content\}\}/g, content || "").replace(/\{\{type\}\}/g, type).replace(/\{\{timestamp\}\}/g, new Date().toISOString());
  } else {
    body = JSON.stringify({ title, content: content || "", type, timestamp: new Date().toISOString() });
  }
  if (config.secret) headers["X-Signature"] = crypto.createHmac("sha256", config.secret).update(body).digest("hex");
  return { body, headers };
}

// === 核心发送方法 ===

async function sendToBot(config: BotConfig, title: string, content: string, type: string): Promise<{ success: boolean; error?: string }> {
  try {
    // App API 模式
    if (config.auth_mode === "app") {
      switch (config.type) {
        case "feishu": return await sendFeishuAppMessage(config, title, content, type);
        case "qq": return await sendQQAppMessage(config, title, content, type);
        default: return { success: false, error: `App API 模式暂不支持 ${config.type}` };
      }
    }

    // Webhook 模式
    let requestBody: string;
    let requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
    let method = "POST";

    switch (config.type) {
      case "feishu": requestBody = JSON.stringify(buildFeishuWebhookMessage(title, content, type, config)); break;
      case "qq": {
        const typeLabel = EVENT_TYPE_LABELS[type] || type;
        const msg: Record<string, unknown> = { markdown: { content: `## 【${typeLabel}】${title}\n\n${content || ""}\n\n---\n> ⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` } };
        if (config.qq_group_id) msg.group_id = config.qq_group_id;
        requestBody = JSON.stringify(msg);
        break;
      }
      case "dingtalk": requestBody = JSON.stringify(buildDingtalkMessage(title, content, type, config)); break;
      case "wechat_work": requestBody = JSON.stringify(buildWechatWorkMessage(title, content, type)); break;
      case "slack": requestBody = JSON.stringify(buildSlackMessage(title, content, type)); break;
      case "custom": {
        const { body, headers } = buildCustomMessage(title, content, type, config);
        requestBody = body; requestHeaders = headers; method = config.custom_method || "POST";
        break;
      }
      default: return { success: false, error: `不支持的机器人类型: ${config.type}` };
    }

    const response = await fetch(config.webhook_url, { method, headers: requestHeaders, body: requestBody, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return { success: false, error: `HTTP ${response.status}: ${errorText.slice(0, 200)}` };
    }
    await query("UPDATE bot_configs SET last_sent_at = NOW(), send_count = send_count + 1 WHERE id = ?", [config.id]);
    return { success: true };
  } catch (error: any) {
    await query("UPDATE bot_configs SET fail_count = fail_count + 1 WHERE id = ?", [config.id]).catch(() => {});
    return { success: false, error: error.message || "发送失败" };
  }
}

// === 推送通知到所有匹配的机器人 ===

export async function pushBotNotification(params: { type: NotificationEventType; title: string; content?: string }): Promise<void> {
  try {
    const configs = await getEnabledBotConfigs();
    for (const config of configs) {
      if (config.subscribe_events && config.subscribe_events.length > 0 && !config.subscribe_events.includes(params.type)) continue;
      sendToBot(config, params.title, params.content || "", params.type).catch((err) => {
        console.error(`[BotNotification] 发送到机器人 ${config.name}(${config.type}) 失败:`, err);
      });
    }
  } catch (error) {
    console.error("[BotNotification] pushBotNotification error:", error);
  }
}

// === 测试发送 ===

export async function testBotNotification(configId: number): Promise<{ success: boolean; error?: string }> {
  const rows = (await query("SELECT * FROM bot_configs WHERE id = ?", [configId])) as any[];
  if (rows.length === 0) return { success: false, error: "机器人配置不存在" };
  const row = rows[0];
  const config: BotConfig = { ...row, subscribe_events: parseJsonField(row.subscribe_events), custom_headers: parseJsonField(row.custom_headers) };
  return sendToBot(config, "🔔 测试通知", `这是一条测试消息，来自「${config.name}」机器人。\n认证模式: ${config.auth_mode === "app" ? "App API" : "Webhook"}\n⏰ ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`, "system");
}

// === 测试连通性（不发送消息，仅验证连接/认证） ===

export async function testBotConnection(configId: number): Promise<{ success: boolean; error?: string; latency?: number }> {
  const rows = (await query("SELECT * FROM bot_configs WHERE id = ?", [configId])) as any[];
  if (rows.length === 0) return { success: false, error: "机器人配置不存在" };
  const row = rows[0];
  const config: BotConfig = { ...row, subscribe_events: parseJsonField(row.subscribe_events), custom_headers: parseJsonField(row.custom_headers) };

  const startTime = Date.now();

  try {
    // App API 模式：验证能否获取 access_token
    if (config.auth_mode === "app") {
      switch (config.type) {
        case "feishu": {
          if (!config.app_id || !config.app_secret) return { success: false, error: "缺少 App ID 或 App Secret" };
          const token = await getFeishuTenantAccessToken(config.app_id, config.app_secret, config.id);
          const latency = Date.now() - startTime;
          if (!token) return { success: false, error: "获取飞书 tenant_access_token 失败，请检查 App ID 和 App Secret", latency };
          if (!config.chat_id) return { success: false, error: "飞书 App 模式下缺少 Chat ID", latency };
          return { success: true, latency };
        }
        case "qq": {
          if (!config.app_id || !config.app_secret) return { success: false, error: "缺少 App ID 或 App Secret" };
          const token = await getQQAccessToken(config.app_id, config.app_secret, config.id);
          const latency = Date.now() - startTime;
          if (!token) return { success: false, error: "获取 QQ access_token 失败，请检查 App ID 和 App Secret", latency };
          if (!config.chat_id) return { success: false, error: "QQ App 模式下缺少 Channel ID", latency };
          return { success: true, latency };
        }
        default:
          return { success: false, error: `App API 模式暂不支持 ${config.type} 的连通性测试` };
      }
    }

    // Webhook 模式：发送轻量级请求验证连通性
    if (!config.webhook_url) return { success: false, error: "缺少 Webhook 地址" };

    switch (config.type) {
      case "feishu": {
        // 飞书 Webhook 没有独立的连通性检测接口，发送一条测试文本消息
        const ts = Math.floor(Date.now() / 1000);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const msg: Record<string, unknown> = {
          msg_type: "text",
          timestamp: String(ts),
          content: { text: "🔗 连通性测试" },
        };
        if (config.secret) msg.sign = signFeishu(config.secret, ts);

        const res = await fetch(config.webhook_url, {
          method: "POST",
          headers,
          body: JSON.stringify(msg),
          signal: AbortSignal.timeout(10000),
        });
        const latency = Date.now() - startTime;
        const data = await res.json();
        if (data.code === 0 || data.StatusCode === 0) return { success: true, latency };
        return { success: false, error: `飞书 Webhook 返回错误: ${data.msg || data.StatusMessage || JSON.stringify(data)}`, latency };
      }
      case "dingtalk": {
        // 钉钉 Webhook：发送一条轻量消息验证
        const msg: Record<string, unknown> = { msgtype: "text", text: { content: "🔗 连通性测试" } };
        const ts = Date.now();
        if (config.secret) {
          msg.timestamp = String(ts);
          msg.sign = crypto.createHmac("sha256", config.secret).update(`${ts}\n${config.secret}`).digest("base64");
        }
        const res = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
          signal: AbortSignal.timeout(10000),
        });
        const latency = Date.now() - startTime;
        const data = await res.json();
        if (data.errcode === 0) return { success: true, latency };
        return { success: false, error: `钉钉 Webhook 返回错误: ${data.errmsg || JSON.stringify(data)}`, latency };
      }
      case "wechat_work": {
        // 企业微信：发送一条轻量消息验证
        const msg = { msgtype: "text", text: { content: "🔗 连通性测试" } };
        const res = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
          signal: AbortSignal.timeout(10000),
        });
        const latency = Date.now() - startTime;
        const data = await res.json();
        if (data.errcode === 0) return { success: true, latency };
        return { success: false, error: `企业微信返回错误: ${data.errmsg || JSON.stringify(data)}`, latency };
      }
      case "qq": {
        // QQ Webhook
        const msg: Record<string, unknown> = { markdown: { content: "🔗 连通性测试" } };
        if (config.qq_group_id) msg.group_id = config.qq_group_id;
        const res = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
          signal: AbortSignal.timeout(10000),
        });
        const latency = Date.now() - startTime;
        if (res.ok) return { success: true, latency };
        const errText = await res.text().catch(() => "");
        return { success: false, error: `QQ Webhook 返回 HTTP ${res.status}: ${errText.slice(0, 200)}`, latency };
      }
      case "slack": {
        // Slack：发送轻量验证
        const msg = { text: "🔗 连通性测试" };
        const res = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
          signal: AbortSignal.timeout(10000),
        });
        const latency = Date.now() - startTime;
        if (res.ok) return { success: true, latency };
        const errText = await res.text().catch(() => "");
        return { success: false, error: `Slack 返回 HTTP ${res.status}: ${errText.slice(0, 200)}`, latency };
      }
      case "custom": {
        // 自定义 Webhook：发送 OPTIONS/HEAD 或轻量 POST
        const method = config.custom_method || "POST";
        const headers: Record<string, string> = { "Content-Type": "application/json", ...(config.custom_headers || {}) };
        let body: string;
        if (config.custom_body_template) {
          body = config.custom_body_template
            .replace(/\{\{title\}\}/g, "连通性测试")
            .replace(/\{\{content\}\}/g, "连通性测试")
            .replace(/\{\{type\}\}/g, "system")
            .replace(/\{\{timestamp\}\}/g, new Date().toISOString());
        } else {
          body = JSON.stringify({ title: "连通性测试", content: "连通性测试", type: "system", timestamp: new Date().toISOString() });
        }
        if (config.secret) headers["X-Signature"] = crypto.createHmac("sha256", config.secret).update(body).digest("hex");

        const res = await fetch(config.webhook_url, { method, headers, body, signal: AbortSignal.timeout(10000) });
        const latency = Date.now() - startTime;
        if (res.ok) return { success: true, latency };
        const errText = await res.text().catch(() => "");
        return { success: false, error: `自定义 Webhook 返回 HTTP ${res.status}: ${errText.slice(0, 200)}`, latency };
      }
      default:
        return { success: false, error: `不支持的机器人类型: ${config.type}` };
    }
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return { success: false, error: error.message || "连通性测试失败", latency };
  }
}