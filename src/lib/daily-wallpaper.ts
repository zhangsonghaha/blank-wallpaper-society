import { db } from "@/lib/db";

/** 日期字符串的简单 hash，用于生成稳定的随机种子 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/** 基于种子的伪随机数生成器（保证同一种子产生相同序列） */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** 获取今日日期字符串 YYYY-MM-DD */
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

interface DailyWallpaperData {
  date: string;
  pick: any | null;
  collection: any[];
  theme: string;
}

/** 缓存结构 */
interface CacheEntry {
  key: string;
  data: DailyWallpaperData;
  expiresAt: number; // timestamp ms
}

/** 内存缓存 */
const cache = new Map<string, CacheEntry>();

/** 定时清理过期缓存 */
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  // 每分钟清理一次过期缓存
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
  }, 60_000);

  // 防止 Node.js 进程因定时器无法退出
  if (cleanupTimer && typeof (cleanupTimer as any).unref === "function") {
    (cleanupTimer as any).unref();
  }
}

startCleanup();

/** 计算到下一个零点的毫秒数 */
function msUntilNextMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime() + 5000; // 多 5 秒缓冲
}

/** 分类中文主题映射 */
const CATEGORY_THEMES: Record<string, string> = {
  nature: "自然风光",
  landscape: "山水风景",
  city: "城市建筑",
  architecture: "建筑艺术",
  animal: "动物世界",
  food: "美食诱惑",
  art: "艺术创意",
  abstract: "抽象意境",
  travel: "旅行探索",
  technology: "科技未来",
  sport: "运动活力",
  music: "音乐之声",
  movie: "影视经典",
  game: "游戏世界",
  car: "速度激情",
  flower: "花卉之美",
  space: "星际宇宙",
  minimal: "极简主义",
  dark: "暗黑风格",
};

function getThemeFromCategory(category: string): string {
  return CATEGORY_THEMES[category?.toLowerCase()] || category || "精选推荐";
}

/** 从图片列表中基于种子选取指定数量的图片 */
function pickImagesWithSeed(
  images: any[],
  seed: number,
  count: number,
  excludeIds: Set<number> = new Set()
): any[] {
  const available = images.filter((img) => !excludeIds.has(img.id));
  if (available.length === 0) return [];

  const random = seededRandom(seed);
  const selected: any[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count && usedIndices.size < available.length; i++) {
    let idx = Math.floor(random() * available.length);
    // 避免重复（小列表碰撞时最多尝试 100 次）
    let attempts = 0;
    while (usedIndices.has(idx) && attempts < 100) {
      idx = Math.floor(random() * available.length);
      attempts++;
    }
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      selected.push(available[idx]);
    }
  }

  return selected;
}

/**
 * 获取每日壁纸数据（含缓存）
 */
export async function getDailyWallpaper(dateStr?: string): Promise<DailyWallpaperData> {
  const date = dateStr || getTodayString();
  const cacheKey = `daily-${date}`;

  // 检查缓存
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 查询所有审核通过的图片，按综合评分排序
  const images = await db.selectFrom("images")
    .where("status", "=", "approved")
    .select([
      "id", "title", "description", "url", "thumbnail_url", "width", "height",
      "category", "tags", "author", "view_count", "download_count",
      "favorite_count", "created_at", "dominant_color", "media_type", "video_url",
    ])
    .limit(500)
    .execute();

  // 确保至少有图片
  if (images.length === 0) {
    const empty: DailyWallpaperData = {
      date,
      pick: null,
      collection: [],
      theme: "精选推荐",
    };
    return empty;
  }

  // 使用日期 hash 作为种子
  const seed = hashCode(date);

  // 选取 1 张精选
  const pickImages = pickImagesWithSeed(images, seed, 1);
  const pick = pickImages[0] || null;

  // 选取 7 张备选（排除精选）
  const excludeIds = new Set<number>();
  if (pick) excludeIds.add(pick.id);
  const collection = pickImagesWithSeed(images, seed + 1, 7, excludeIds);

  // 主题根据精选图片分类确定
  const theme = pick ? getThemeFromCategory(pick.category) : "精选推荐";

  const data: DailyWallpaperData = {
    date,
    pick,
    collection,
    theme,
  };

  // 缓存到次日零点
  const ttl = msUntilNextMidnight();
  cache.set(cacheKey, {
    key: cacheKey,
    data,
    expiresAt: Date.now() + ttl,
  });

  return data;
}

/**
 * 获取最近 N 天的每日壁纸（用于 RSS）
 */
export async function getRecentDailyWallpapers(days: number = 30): Promise<DailyWallpaperData[]> {
  const results: DailyWallpaperData[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const data = await getDailyWallpaper(dateStr);
    if (data.pick) {
      results.push(data);
    }
  }

  return results;
}