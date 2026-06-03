import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0"),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

export default redis;

// ============================================================
// 缓存 Key 命名常量 —— 统一管理，避免散落字符串
// ============================================================
export const CacheKeys = {
  /** 分类列表 */
  CATEGORIES: "categories:list",
  /** 排行榜 rankings:{period}:{type} */
  RANKINGS: (period: string, type: string) => `rankings:${period}:${type}`,
  /** 用户关注统计 follow:stats:{userId} */
  FOLLOW_STATS: (userId: number | string) => `follow:stats:${userId}`,
  /** 用户公开主页 profile:{userId} */
  USER_PROFILE: (userId: number | string) => `profile:${userId}`,
  /** 主题专区列表 */
  THEME_ZONES: "discover:theme-zones",
  /** 主题专区详情 theme-zone-detail:{zoneKey}:{page}:{limit} */
  THEME_ZONE_DETAIL: (zoneKey: string, page: number, limit: number) =>
    `discover:theme-zone-detail:${zoneKey}:${page}:${limit}`,
  /** 编辑精选轮播 */
  FEATURED_CAROUSEL: "discover:featured-carousel",
  /** 新人专区 */
  FRESH_PICKS: "discover:fresh-picks",
  /** Feed 热门流 feed:trending:{page}:{limit} */
  FEED_TRENDING: (page: number, limit: number) =>
    `feed:trending:${page}:${limit}`,
} as const;

// ============================================================
// TTL 常量（秒）
// ============================================================
export const CacheTTL = {
  CATEGORIES: 3600,        // 1 小时（变更频率极低）
  RANKINGS: 1800,          // 30 分钟（定时刷新）
  FOLLOW_STATS: 120,       // 2 分钟（短期缓存）
  USER_PROFILE: 300,       // 5 分钟
  THEME_ZONES: 1800,       // 30 分钟（配置型数据）
  THEME_ZONE_DETAIL: 600,  // 10 分钟
  FEATURED_CAROUSEL: 3600, // 1 小时（编辑精选变更少）
  FRESH_PICKS: 600,        // 10 分钟
  FEED_TRENDING: 300,      // 5 分钟
} as const;

// ============================================================
// 基础操作
// ============================================================

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCache(
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error("Redis setCache error:", err);
  }
}

export async function delCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Redis delCache error:", err);
  }
}

/**
 * 使用 SCAN 安全地批量删除匹配 pattern 的 key。
 * 替代原来的 KEYS 命令，避免阻塞 Redis 事件循环。
 */
export async function clearPattern(pattern: string): Promise<void> {
  try {
    const pipeline = redis.pipeline();
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        pipeline.del(...keys);
      }
    } while (cursor !== "0");

    await pipeline.exec();
  } catch (err) {
    console.error("Redis clearPattern error:", err);
  }
}

// ============================================================
// 高级操作 —— Cache-Aside 模式
// ============================================================

/**
 * Cache-Aside（旁路缓存）：先查缓存，命中直接返回；
 * 未命中则执行 fetcher 获取数据，写入缓存后返回。
 *
 * @param key        缓存 key
 * @param fetcher    缓存未命中时的数据获取函数
 * @param ttlSeconds 缓存过期时间（秒），默认 300
 */
export async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // 1. 尝试读取缓存
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 2. 缓存未命中 → 从数据源获取
  const data = await fetcher();

  // 3. 写入缓存（异步不阻塞返回）
  setCache(key, data, ttlSeconds).catch(() => {});

  return data;
}
