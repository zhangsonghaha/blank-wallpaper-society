import { db } from "@/lib/db";
import { sql } from "kysely";
import redis from "@/lib/redis";

// ========== API 套餐配置 ==========
export const API_TIERS = {
  free: {
    name: "免费版",
    rateLimit: 100, // 次/小时
    dailyLimit: 1000,
    price: 0,
    features: ["基础壁纸搜索", "标准分辨率下载", "100次/小时"],
  },
  pro: {
    name: "专业版",
    rateLimit: 1000, // 次/小时
    dailyLimit: 10000,
    price: 29,
    features: ["高级搜索过滤", "高清分辨率下载", "1000次/小时", "优先支持"],
  },
  enterprise: {
    name: "企业版",
    rateLimit: -1, // 无限
    dailyLimit: -1,
    price: 99,
    features: ["无限API调用", "原始分辨率下载", "专属支持", "SLA保障"],
  },
} as const;

export type ApiTier = keyof typeof API_TIERS;

// ========== 内存限流存储（Redis 不可用时降级） ==========
interface RateLimitEntry {
  count: number;
  resetAt: number; // 时间戳（ms），当天的结束时间
}

// 内存降级存储，仅在 Redis 不可用时使用
const memoryRateLimitStore = new Map<string, RateLimitEntry>();

// 匿名IP每日请求上限
const ANONYMOUS_DAILY_LIMIT = 100;

// ========== 端点级别细粒度限流配置 ==========
export const ENDPOINT_RATE_LIMITS: Record<string, { window: "minute" | "hour" | "day"; limit: number; description: string }> = {
  // 下载端点：免费用户10次/小时
  "GET:/api/images/[id]/download": { window: "hour", limit: 10, description: "下载限流" },
  // 搜索端点：30次/分钟
  "GET:/api/images": { window: "minute", limit: 30, description: "搜索限流" },
  "GET:/api/images/search/facets": { window: "minute", limit: 15, description: "搜索分面限流" },
  // AI生成端点：已在 ai-generate route 中实现每日配额
  "POST:/api/ai-generate": { window: "day", limit: 3, description: "AI生成限流" },
  // 上传端点：10次/小时
  "POST:/api/upload": { window: "hour", limit: 10, description: "上传限流" },
  "POST:/api/upload/batch": { window: "hour", limit: 5, description: "批量上传限流" },
  // 评论端点：5次/分钟
  "POST:/api/images/[id]/comments": { window: "minute", limit: 5, description: "评论限流" },
  // 收藏端点：30次/分钟
  "PATCH:/api/images/[id]": { window: "minute", limit: 30, description: "收藏/更新限流" },
};

// 会员等级对应限流倍数
const TIER_MULTIPLIERS: Record<string, number> = {
  free: 1,
  pro: 10,
  enterprise: -1, // 无限
};

// 每10分钟清理过期条目
if (typeof globalThis !== "undefined") {
  const cleanInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryRateLimitStore) {
      if (now > entry.resetAt) {
        memoryRateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
  if (cleanInterval && typeof cleanInterval === "object" && "unref" in cleanInterval) {
    (cleanInterval as NodeJS.Timeout).unref();
  }
}

// 检查 Redis 是否可用
async function isRedisAvailable(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * 获取今天结束的时间戳（UTC+8午夜）
 */
function getEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

/**
 * 记录API使用日志
 */
export async function logApiUsage(
  apiKeyId: number | null,
  endpoint: string,
  ipAddress: string,
  statusCode: number
) {
  try {
    if (apiKeyId) {
      await db.insertInto("api_usage_logs")
        .values({
          api_key_id: apiKeyId,
          endpoint,
          ip_address: ipAddress,
          status_code: statusCode,
        })
        .execute();
    }
  } catch (err) {
    console.error("记录API使用日志失败:", err);
  }
}

/**
 * 更新API Key的最后使用时间
 */
export async function updateKeyLastUsed(apiKeyId: number) {
  try {
    await db.updateTable("api_keys")
      .set({ last_used_at: sql`NOW()` })
      .where("id", "=", apiKeyId)
      .execute();
  } catch (err) {
    console.error("更新API Key最后使用时间失败:", err);
  }
}

/**
 * 基于API Key的限流检查（优先 Redis，降级内存）
 * @returns { allowed: boolean; limit: number; remaining: number; reset: number }
 */
export async function checkApiKeyRateLimit(
  apiKeyId: number,
  rateLimit: number
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const key = `ratelimit:apiKey:${apiKeyId}`;
  const resetAt = getEndOfDay();
  const now = Date.now();
  const ttlSeconds = Math.ceil((resetAt - now) / 1000);

  // 尝试使用 Redis
  if (await isRedisAvailable()) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      const allowed = count <= rateLimit;
      return {
        allowed,
        limit: rateLimit,
        remaining: allowed ? Math.max(0, rateLimit - count) : 0,
        reset: ttlSeconds,
      };
    } catch {
      // Redis 失败，降级到内存
    }
  }

  // 内存降级
  let entry = memoryRateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt };
    memoryRateLimitStore.set(key, entry);
  }

  const remaining = Math.max(0, rateLimit - entry.count);
  const allowed = entry.count < rateLimit;

  if (allowed) {
    entry.count++;
  }

  return {
    allowed,
    limit: rateLimit,
    remaining: allowed ? Math.max(0, rateLimit - entry.count) : 0,
    reset: Math.ceil((resetAt - now) / 1000),
  };
}

/**
 * 基于IP的匿名限流检查（优先 Redis，降级内存）
 * @returns { allowed: boolean; limit: number; remaining: number; reset: number }
 */
export async function checkIpRateLimit(ipAddress: string): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const key = `ratelimit:ip:${ipAddress}`;
  const resetAt = getEndOfDay();
  const now = Date.now();
  const ttlSeconds = Math.ceil((resetAt - now) / 1000);

  // 尝试使用 Redis
  if (await isRedisAvailable()) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      const allowed = count <= ANONYMOUS_DAILY_LIMIT;
      return {
        allowed,
        limit: ANONYMOUS_DAILY_LIMIT,
        remaining: allowed ? Math.max(0, ANONYMOUS_DAILY_LIMIT - count) : 0,
        reset: ttlSeconds,
      };
    } catch {
      // Redis 失败，降级到内存
    }
  }

  // 内存降级
  let entry = memoryRateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt };
    memoryRateLimitStore.set(key, entry);
  }

  const remaining = Math.max(0, ANONYMOUS_DAILY_LIMIT - entry.count);
  const allowed = entry.count < ANONYMOUS_DAILY_LIMIT;

  if (allowed) {
    entry.count++;
  }

  return {
    allowed,
    limit: ANONYMOUS_DAILY_LIMIT,
    remaining: allowed ? Math.max(0, ANONYMOUS_DAILY_LIMIT - entry.count) : 0,
    reset: Math.ceil((resetAt - now) / 1000),
  };
}

/**
 * 通过API Key哈希查找Key信息
 * 包含过期检查：过期Key自动标记为不活跃
 */
export async function findApiKeyByKey(rawKey: string): Promise<{
  id: number;
  user_id: number;
  key_prefix: string;
  name: string;
  rate_limit: number;
  is_active: boolean;
} | null> {
  const crypto = await import("crypto");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const rows = await db.selectFrom("api_keys")
    .where("key_hash", "=", keyHash)
    .select(["id", "user_id", "key_prefix", "name", "rate_limit", "is_active", "expires_at"])
    .execute();

  if (rows.length === 0) return null;

  const key = rows[0];

  // 检查是否已过期
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    // 异步标记为不活跃
    db.updateTable("api_keys")
      .set({ is_active: 0 })
      .where("id", "=", key.id)
      .execute()
      .catch(() => {});
    return {
      id: key.id,
      user_id: key.user_id,
      key_prefix: key.key_prefix,
      name: key.name,
      rate_limit: key.rate_limit ?? 0,
      is_active: false,
    };
  }

  return {
    id: key.id,
    user_id: key.user_id,
    key_prefix: key.key_prefix,
    name: key.name,
    rate_limit: key.rate_limit ?? 0,
    is_active: !!key.is_active,
  };
}

/**
 * 获取API Key的使用统计（增强版）
 */
export async function getApiKeyUsageStats(apiKeyId: number): Promise<{
  today: number;
  last7days: number;
  last30days: number;
  hourlyBreakdown: Array<{ hour: string; count: number }>;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}> {
  const todayResult = await db.selectFrom("api_usage_logs")
    .where("api_key_id", "=", apiKeyId)
    .where("created_at", ">=", sql<Date>`CURDATE()`)
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst();

  const last7Result = await db.selectFrom("api_usage_logs")
    .where("api_key_id", "=", apiKeyId)
    .where("created_at", ">=", sql<Date>`DATE_SUB(CURDATE(), INTERVAL 7 DAY)`)
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst();

  const last30Result = await db.selectFrom("api_usage_logs")
    .where("api_key_id", "=", apiKeyId)
    .where("created_at", ">=", sql<Date>`DATE_SUB(CURDATE(), INTERVAL 30 DAY)`)
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst();

  // 24小时分布
  const hourlyBreakdown = await db.selectFrom("api_usage_logs")
    .where("api_key_id", "=", apiKeyId)
    .where("created_at", ">=", sql<Date>`DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
    .select((eb) => [
      sql<string>`DATE_FORMAT(created_at, '%Y-%m-%d %H:00')`.as("hour"),
      eb.fn.countAll().as("count"),
    ])
    .groupBy("hour")
    .orderBy("hour")
    .execute();

  // 错误率
  const errorStats = await db.selectFrom("api_usage_logs")
    .where("api_key_id", "=", apiKeyId)
    .where("created_at", ">=", sql<Date>`DATE_SUB(CURDATE(), INTERVAL 7 DAY)`)
    .select((eb) => [
      eb.fn.countAll().as("total"),
      sql<number>`SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)`.as("errors"),
    ])
    .executeTakeFirst();
  const total7d = Number(errorStats?.total ?? 0);
  const errors7d = Number(errorStats?.errors ?? 0);
  const errorRate = total7d > 0 ? errors7d / total7d : 0;

  // 热门端点
  const topEndpoints = await db.selectFrom("api_usage_logs")
    .where("api_key_id", "=", apiKeyId)
    .where("created_at", ">=", sql<Date>`DATE_SUB(CURDATE(), INTERVAL 7 DAY)`)
    .select((eb) => ["endpoint", eb.fn.countAll().as("count")])
    .groupBy("endpoint")
    .orderBy("count", "desc")
    .limit(10)
    .execute();

  return {
    today: Number(todayResult?.count ?? 0),
    last7days: Number(last7Result?.count ?? 0),
    last30days: Number(last30Result?.count ?? 0),
    hourlyBreakdown: hourlyBreakdown.map((r) => ({ hour: r.hour, count: Number(r.count) })),
    errorRate: Math.round(errorRate * 10000) / 100, // 百分比，保留2位
    topEndpoints: topEndpoints.map((r) => ({ endpoint: r.endpoint, count: Number(r.count) })),
  };
}

/**
 * 构建限流响应头
 */
export function buildRateLimitHeaders(
  limit: number,
  remaining: number,
  reset: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(reset),
  };
}

// ========== 端点级别细粒度限流 ==========

/**
 * 获取窗口对应的秒数
 */
function getWindowSeconds(window: "minute" | "hour" | "day"): number {
  switch (window) {
    case "minute": return 60;
    case "hour": return 3600;
    case "day": return 86400;
  }
}

/**
 * 匹配端点模式（支持通配符如 [id]）
 */
function matchEndpoint(pattern: string, method: string, path: string): boolean {
  const patternParts = pattern.split(":");
  if (patternParts[0] !== method) return false;
  const patternPath = patternParts[1];
  const pathParts = patternPath.split("/");
  const urlParts = path.split("/");
  if (pathParts.length !== urlParts.length) return false;
  return pathParts.every((p, i) => p.startsWith("[") || p === urlParts[i]);
}

/**
 * 端点级别限流检查（基于IP，Redis优先，内存降级）
 * @returns 允许/限制信息，null表示该端点无限流配置
 */
export async function checkEndpointRateLimit(
  method: string,
  path: string,
  ipAddress: string,
  userTier: string = "free"
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  endpoint: string;
} | null> {
  // 查找匹配的端点配置
  let matchedPattern: string | null = null;
  let config: { window: "minute" | "hour" | "day"; limit: number; description: string } | null = null;

  for (const [pattern, cfg] of Object.entries(ENDPOINT_RATE_LIMITS)) {
    if (matchEndpoint(pattern, method, path)) {
      matchedPattern = pattern;
      config = cfg;
      break;
    }
  }

  if (!config || !matchedPattern) return null;

  // 企业用户无限流
  const tierMultiplier = TIER_MULTIPLIERS[userTier] || 1;
  if (tierMultiplier === -1) {
    return { allowed: true, limit: -1, remaining: -1, reset: 0, endpoint: matchedPattern };
  }

  const effectiveLimit = config.limit * tierMultiplier;
  const windowSeconds = getWindowSeconds(config.window);
  const key = `ratelimit:endpoint:${method}:${path}:${ipAddress}`;
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;

  // Redis 优先
  if (await isRedisAvailable()) {
    try {
      const redisKey = `ep:${method}:${matchedPattern}:${ipAddress}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, windowSeconds);
      }
      const allowed = count <= effectiveLimit;
      return {
        allowed,
        limit: effectiveLimit,
        remaining: allowed ? Math.max(0, effectiveLimit - count) : 0,
        reset: windowSeconds,
        endpoint: matchedPattern,
      };
    } catch {}
  }

  // 内存降级
  let entry = memoryRateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt };
    memoryRateLimitStore.set(key, entry);
  }

  const allowed = entry.count < effectiveLimit;
  if (allowed) entry.count++;

  return {
    allowed,
    limit: effectiveLimit,
    remaining: allowed ? Math.max(0, effectiveLimit - entry.count) : 0,
    reset: Math.ceil((resetAt - now) / 1000),
    endpoint: matchedPattern,
  };
}