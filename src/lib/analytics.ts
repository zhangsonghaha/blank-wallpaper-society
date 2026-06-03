/**
 * 用户行为分析库
 * 支持 Umami 和 PostHog 两种分析服务
 * 服务端事件追踪 + 客户端配置
 */

import { db } from "@/lib/db";

// === 分析事件类型 ===

export type AnalyticsEvent =
  | "page_view"
  | "image_upload"
  | "image_download"
  | "image_favorite"
  | "image_share"
  | "comment_create"
  | "user_register"
  | "user_login"
  | "search"
  | "collection_create"
  | "purchase"
  | "achievement_unlock";

// === 分析配置 ===

export interface AnalyticsConfig {
  provider: "umami" | "posthog" | "none";
  /** Umami: 网站 ID */
  umami_website_id: string;
  /** Umami: API 地址 */
  umami_api_url: string;
  /** PostHog: API Key */
  posthog_api_key: string;
  /** PostHog: API Host */
  posthog_api_host: string;
}

let analyticsConfigCache: { config: AnalyticsConfig; expiresAt: number } | null = null;
const ANALYTICS_CONFIG_TTL = 5 * 60 * 1000; // 5 分钟缓存

/** 清除分析配置缓存 */
export function clearAnalyticsConfigCache(): void {
  analyticsConfigCache = null;
}

/** 获取分析配置 */
export async function getAnalyticsConfig(): Promise<AnalyticsConfig> {
  if (analyticsConfigCache && Date.now() < analyticsConfigCache.expiresAt) {
    return analyticsConfigCache.config;
  }

  const defaultConfig: AnalyticsConfig = {
    provider: "none",
    umami_website_id: "",
    umami_api_url: "",
    posthog_api_key: "",
    posthog_api_host: "",
  };

  try {
    const rows = await db.selectFrom("system_settings")
      .where("setting_key", "in", [
        "analytics_provider",
        "analytics_umami_website_id",
        "analytics_umami_api_url",
        "analytics_posthog_api_key",
        "analytics_posthog_api_host",
      ])
      .select(["setting_key", "setting_value"])
      .execute();

    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (row.setting_value) {
        settings[row.setting_key] = row.setting_value;
      }
    }

    const config: AnalyticsConfig = {
      provider: (settings.analytics_provider as any) || "none",
      umami_website_id: settings.analytics_umami_website_id || "",
      umami_api_url: settings.analytics_umami_api_url || "",
      posthog_api_key: settings.analytics_posthog_api_key || "",
      posthog_api_host: settings.analytics_posthog_api_host || "https://app.posthog.com",
    };

    analyticsConfigCache = {
      config,
      expiresAt: Date.now() + ANALYTICS_CONFIG_TTL,
    };

    return config;
  } catch {
    return defaultConfig;
  }
}

// === 服务端事件追踪 ===

/**
 * 追踪服务端事件（发送到 Umami）
 */
export async function trackServerEvent(
  event: AnalyticsEvent,
  data?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const config = await getAnalyticsConfig();
    if (config.provider === "none") return;

    if (config.provider === "umami" && config.umami_website_id && config.umami_api_url) {
      await fetch(`${config.umami_api_url}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BlankWallpaperSociety/1.0",
        },
        body: JSON.stringify({
          type: "event",
          payload: {
            website: config.umami_website_id,
            name: event,
            data: data || {},
          },
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }

    if (config.provider === "posthog" && config.posthog_api_key) {
      // PostHog 服务端追踪通过其 REST API
      await fetch(`${config.posthog_api_host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: config.posthog_api_key,
          event: event,
          properties: {
            distinct_id: "server",
            ...data,
          },
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
  } catch (error) {
    console.error("[Analytics] trackServerEvent error:", error);
  }
}

/**
 * 异步追踪服务端事件
 */
export function trackServerEventAsync(
  event: AnalyticsEvent,
  data?: Record<string, string | number | boolean>
): void {
  trackServerEvent(event, data).catch(() => {});
}

// === 客户端分析配置 API ===

/**
 * 获取客户端分析配置（不含敏感密钥）
 * 用于注入到前端页面
 */
export async function getClientAnalyticsConfig(): Promise<{
  provider: string;
  umami_website_id: string;
  umami_script_url: string;
  posthog_api_key: string;
  posthog_api_host: string;
}> {
  const config = await getAnalyticsConfig();
  return {
    provider: config.provider,
    umami_website_id: config.umami_website_id,
    umami_script_url: config.umami_api_url
      ? `${config.umami_api_url}/script.js`
      : "",
    posthog_api_key: config.posthog_api_key,
    posthog_api_host: config.posthog_api_host,
  };
}