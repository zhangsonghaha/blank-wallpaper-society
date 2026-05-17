import { query } from "@/lib/db";
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
      await query(
        "INSERT INTO api_usage_logs (api_key_id, endpoint, ip_address, status_code) VALUES (?, ?, ?, ?)",
        [apiKeyId, endpoint, ipAddress, statusCode]
      );
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
    await query(
      "UPDATE api_keys SET last_used_at = NOW() WHERE id = ?",
      [apiKeyId]
    );
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

  const rows = (await query(
    "SELECT id, user_id, key_prefix, name, rate_limit, is_active FROM api_keys WHERE key_hash = ?",
    [keyHash]
  )) as any[];

  if (rows.length === 0) return null;
  return rows[0];
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
  const today = (await query(
    "SELECT COUNT(*) as count FROM api_usage_logs WHERE api_key_id = ? AND created_at >= CURDATE()",
    [apiKeyId]
  )) as any[];

  const last7 = (await query(
    "SELECT COUNT(*) as count FROM api_usage_logs WHERE api_key_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
    [apiKeyId]
  )) as any[];

  const last30 = (await query(
    "SELECT COUNT(*) as count FROM api_usage_logs WHERE api_key_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
    [apiKeyId]
  )) as any[];

  // 24小时分布
  const hourlyBreakdown = (await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:00') as hour, COUNT(*) as count
     FROM api_usage_logs
     WHERE api_key_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
     GROUP BY hour ORDER BY hour`,
    [apiKeyId]
  )) as any[];

  // 错误率
  const errorStats = (await query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
     FROM api_usage_logs
     WHERE api_key_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
    [apiKeyId]
  )) as any[];
  const total7d = errorStats[0]?.total || 0;
  const errors7d = errorStats[0]?.errors || 0;
  const errorRate = total7d > 0 ? errors7d / total7d : 0;

  // 热门端点
  const topEndpoints = (await query(
    `SELECT endpoint, COUNT(*) as count
     FROM api_usage_logs
     WHERE api_key_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY endpoint ORDER BY count DESC LIMIT 10`,
    [apiKeyId]
  )) as any[];

  return {
    today: today[0]?.count || 0,
    last7days: last7[0]?.count || 0,
    last30days: last30[0]?.count || 0,
    hourlyBreakdown,
    errorRate: Math.round(errorRate * 10000) / 100, // 百分比，保留2位
    topEndpoints,
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