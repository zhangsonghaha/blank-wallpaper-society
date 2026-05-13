import { query } from "@/lib/db";

// ========== 内存限流存储 ==========
interface RateLimitEntry {
  count: number;
  resetAt: number; // 时间戳（ms），当天的结束时间
}

// 全局Map存储，key格式: "apiKey:{id}" 或 "ip:{ip}"
const rateLimitStore = new Map<string, RateLimitEntry>();

// 匿名IP每日请求上限
const ANONYMOUS_DAILY_LIMIT = 100;

// 每10分钟清理过期条目
if (typeof globalThis !== "undefined") {
  const cleanInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
  // 防止Node.js进程因定时器不退出
  if (cleanInterval && typeof cleanInterval === "object" && "unref" in cleanInterval) {
    (cleanInterval as NodeJS.Timeout).unref();
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
 * 基于API Key的限流检查
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
  const key = `apiKey:${apiKeyId}`;
  const resetAt = getEndOfDay();
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // 如果过期了或不存在，重置
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt };
    rateLimitStore.set(key, entry);
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
    reset: Math.ceil((resetAt - now) / 1000), // 秒
  };
}

/**
 * 基于IP的匿名限流检查
 * @returns { allowed: boolean; limit: number; remaining: number; reset: number }
 */
export function checkIpRateLimit(ipAddress: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
} {
  const key = `ip:${ipAddress}`;
  const resetAt = getEndOfDay();
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt };
    rateLimitStore.set(key, entry);
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
 * 获取API Key的使用统计
 */
export async function getApiKeyUsageStats(apiKeyId: number): Promise<{
  today: number;
  last7days: number;
  last30days: number;
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

  return {
    today: today[0]?.count || 0,
    last7days: last7[0]?.count || 0,
    last30days: last30[0]?.count || 0,
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