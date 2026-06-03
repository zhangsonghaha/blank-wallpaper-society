import { db } from "@/lib/db";
import { notifyAchievementUnlocked } from "@/lib/notification";

// === 等级配置 ===
const LEVELS = [
  { level: 1, title: "新手", minExp: 0 },
  { level: 2, title: "入门", minExp: 50 },
  { level: 3, title: "熟练", minExp: 150 },
  { level: 4, title: "达人", minExp: 400 },
  { level: 5, title: "专家", minExp: 800 },
  { level: 6, title: "大师", minExp: 1500 },
  { level: 7, title: "宗师", minExp: 3000 },
  { level: 8, title: "传奇", minExp: 6000 },
  { level: 9, title: "史诗", minExp: 12000 },
  { level: 10, title: "神话", minExp: 25000 },
];

// === 类型定义 ===
export interface LevelInfo {
  userId: number;
  level: number;
  title: string;
  exp: number;
  nextExp: number;
  prevExp: number;
  expProgress: number; // 0~1 当前等级进度
}

export interface Achievement {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  conditionType: string;
  conditionValue: number;
  expReward: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number; // 0~1
  currentValue?: number;
}

export interface UserStats {
  uploadCount: number;
  downloadCount: number;
  favoriteCount: number;
  followerCount: number;
  followingCount: number;
  collectionCount: number;
  checkinStreak: number;
}

// === 等级计算 ===
export function calculateLevel(exp: number): { level: number; title: string; nextExp: number; prevExp: number } {
  let currentLevel = LEVELS[0];
  let nextLevel = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (exp >= LEVELS[i].minExp) {
      currentLevel = LEVELS[i];
      nextLevel = LEVELS[i + 1] || LEVELS[i];
      break;
    }
  }

  return {
    level: currentLevel.level,
    title: currentLevel.title,
    nextExp: nextLevel.minExp,
    prevExp: currentLevel.minExp,
  };
}

// === 确保用户等级记录存在 ===
async function ensureUserLevel(userId: number): Promise<void> {
  const rows = await db
    .selectFrom("user_levels")
    .select("id")
    .where("user_id", "=", userId)
    .execute();
  if (rows.length === 0) {
    await db
      .insertInto("user_levels")
      .values({ user_id: userId, level: 1, exp: 0, title: "新手" })
      .execute();
  }
}

// === 增加经验值（使用事务） ===
export async function addExp(userId: number, amount: number): Promise<LevelInfo> {
  return db.transaction().execute(async (trx) => {
    // 确保记录存在
    const rows = await trx
      .selectFrom("user_levels")
      .select(["id", "exp"])
      .where("user_id", "=", userId)
      .forUpdate()
      .execute();

    let currentExp: number;
    if (rows.length === 0) {
      currentExp = 0;
      await trx
        .insertInto("user_levels")
        .values({ user_id: userId, level: 1, exp: 0, title: "新手" })
        .execute();
    } else {
      currentExp = rows[0].exp;
    }

    const newExp = currentExp + amount;
    const levelInfo = calculateLevel(newExp);

    await trx
      .updateTable("user_levels")
      .set({ exp: newExp, level: levelInfo.level, title: levelInfo.title })
      .where("user_id", "=", userId)
      .execute();

    return {
      userId,
      level: levelInfo.level,
      title: levelInfo.title,
      exp: newExp,
      nextExp: levelInfo.nextExp,
      prevExp: levelInfo.prevExp,
      expProgress: levelInfo.nextExp > levelInfo.prevExp
        ? (newExp - levelInfo.prevExp) / (levelInfo.nextExp - levelInfo.prevExp)
        : 1,
    };
  });
}

// === 获取用户统计数据 ===
export async function getUserStats(userId: number): Promise<UserStats> {
  // 上传数
  const uploadRow = await db
    .selectFrom("images")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("uploaded_by", "=", userId)
    .executeTakeFirst();
  const uploadCount = Number(uploadRow?.count || 0);

  // 下载总数（用户上传的图片被下载的总次数）
  const downloadRow = await db
    .selectFrom("images")
    .select((eb) => eb.fn.coalesce(eb.fn.sum("download_count"), eb.val(0)).as("count"))
    .where("uploaded_by", "=", userId)
    .executeTakeFirst();
  const downloadCount = Number(downloadRow?.count || 0);

  // 被收藏总数（用户上传的图片被收藏的总次数）
  const favoriteRow = await db
    .selectFrom("favorites")
    .innerJoin("images", "favorites.image_id", "images.id")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("images.uploaded_by", "=", userId)
    .executeTakeFirst();
  const favoriteCount = Number(favoriteRow?.count || 0);

  // 粉丝数
  const followerRow = await db
    .selectFrom("user_follows")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("following_id", "=", userId)
    .executeTakeFirst();
  const followerCount = Number(followerRow?.count || 0);

  // 关注数
  const followingRow = await db
    .selectFrom("user_follows")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("follower_id", "=", userId)
    .executeTakeFirst();
  const followingCount = Number(followingRow?.count || 0);

  // 用户收藏的图片数（收藏达人成就用）
  const collectionRow = await db
    .selectFrom("favorites")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("user_id", "=", userId)
    .executeTakeFirst();
  const collectionCount = Number(collectionRow?.count || 0);

  return {
    uploadCount,
    downloadCount,
    favoriteCount,
    followerCount,
    followingCount,
    collectionCount,
    checkinStreak: 0, // 签到功能待实现
  };
}

// === 检查并解锁成就（异步，不阻塞主操作） ===
export async function checkAchievements(userId: number): Promise<Achievement[]> {
  try {
    const stats = await getUserStats(userId);

    // 统计值映射
    const statsMap: Record<string, number> = {
      upload_count: stats.uploadCount,
      download_count: stats.downloadCount,
      favorite_count: stats.favoriteCount,
      follower_count: stats.followerCount,
      checkin_streak: stats.checkinStreak,
      collection_count: stats.collectionCount,
    };

    // 获取所有成就定义
    const allAchievements = await db
      .selectFrom("achievements")
      .selectAll()
      .execute();

    // 获取已解锁的成就
    const unlockedRows = await db
      .selectFrom("user_achievements")
      .select(["achievement_id", "unlocked_at"])
      .where("user_id", "=", userId)
      .execute();
    const unlockedSet = new Set(unlockedRows.map((r) => r.achievement_id));
    const unlockedAtMap = new Map(unlockedRows.map((r) => [r.achievement_id, r.unlocked_at]));

    const newlyUnlocked: Achievement[] = [];

    for (const ach of allAchievements) {
      const currentValue = statsMap[ach.condition_type] ?? 0;
      const met = currentValue >= ach.condition_value;

      if (met && !unlockedSet.has(ach.id)) {
        // 解锁成就
        await db
          .insertInto("user_achievements")
          .values({ user_id: userId, achievement_id: ach.id })
          .execute();
        // 成就经验奖励
        await addExp(userId, ach.exp_reward);

        // 推送成就解锁通知
        await notifyAchievementUnlocked(userId, ach.name, ach.id, ach.exp_reward);

        newlyUnlocked.push({
          id: ach.id,
          slug: ach.slug,
          name: ach.name,
          description: ach.description ?? "",
          icon: ach.icon ?? "",
          category: ach.category ?? "",
          conditionType: ach.condition_type,
          conditionValue: ach.condition_value,
          expReward: ach.exp_reward,
          unlocked: true,
          unlockedAt: new Date().toISOString(),
          progress: 1,
          currentValue,
        });
      }
    }

    return newlyUnlocked;
  } catch (error) {
    console.error("checkAchievements error:", error);
    return [];
  }
}

// === 获取用户等级信息 ===
export async function getUserLevel(userId: number): Promise<LevelInfo> {
  await ensureUserLevel(userId);

  const rows = await db
    .selectFrom("user_levels")
    .selectAll()
    .where("user_id", "=", userId)
    .execute();
  const row = rows[0];

  const levelInfo = calculateLevel(row.exp);

  return {
    userId,
    level: levelInfo.level,
    title: levelInfo.title,
    exp: row.exp,
    nextExp: levelInfo.nextExp,
    prevExp: levelInfo.prevExp,
    expProgress: levelInfo.nextExp > levelInfo.prevExp
      ? (row.exp - levelInfo.prevExp) / (levelInfo.nextExp - levelInfo.prevExp)
      : 1,
  };
}

// === 获取用户成就列表（含进度） ===
export async function getUserAchievements(userId: number): Promise<Achievement[]> {
  const stats = await getUserStats(userId);

  const statsMap: Record<string, number> = {
    upload_count: stats.uploadCount,
    download_count: stats.downloadCount,
    favorite_count: stats.favoriteCount,
    follower_count: stats.followerCount,
    checkin_streak: stats.checkinStreak,
    collection_count: stats.collectionCount,
  };

  // 所有成就定义
  const allAchievements = await db
    .selectFrom("achievements")
    .selectAll()
    .orderBy("category")
    .orderBy("condition_value")
    .execute();

  // 已解锁
  const unlockedRows = await db
    .selectFrom("user_achievements")
    .select(["achievement_id", "unlocked_at"])
    .where("user_id", "=", userId)
    .execute();
  const unlockedAtMap = new Map(unlockedRows.map((r) => [r.achievement_id, r.unlocked_at]));

  return allAchievements.map((ach) => {
    const currentValue = statsMap[ach.condition_type] ?? 0;
    const progress = Math.min(currentValue / ach.condition_value, 1);
    const unlocked = unlockedAtMap.has(ach.id);

    return {
      id: ach.id,
      slug: ach.slug,
      name: ach.name,
      description: ach.description ?? "",
      icon: ach.icon ?? "",
      category: ach.category ?? "",
      conditionType: ach.condition_type,
      conditionValue: ach.condition_value,
      expReward: ach.exp_reward,
      unlocked,
      unlockedAt: unlockedAtMap.get(ach.id) instanceof Date
        ? unlockedAtMap.get(ach.id)!.toISOString()
        : (unlockedAtMap.get(ach.id) as string | undefined),
      progress,
      currentValue,
    };
  });
}

// === 获取多个用户的等级信息（批量） ===
export async function getUserLevelsBatch(userIds: number[]): Promise<Map<number, LevelInfo>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .selectFrom("user_levels")
    .selectAll()
    .where("user_id", "in", userIds)
    .execute();

  const result = new Map<number, LevelInfo>();
  for (const row of rows) {
    const levelInfo = calculateLevel(row.exp);
    result.set(row.user_id, {
      userId: row.user_id,
      level: levelInfo.level,
      title: levelInfo.title,
      exp: row.exp,
      nextExp: levelInfo.nextExp,
      prevExp: levelInfo.prevExp,
      expProgress: levelInfo.nextExp > levelInfo.prevExp
        ? (row.exp - levelInfo.prevExp) / (levelInfo.nextExp - levelInfo.prevExp)
        : 1,
    });
  }

  // 为没有等级记录的用户创建默认值
  for (const uid of userIds) {
    if (!result.has(uid)) {
      result.set(uid, {
        userId: uid,
        level: 1,
        title: "新手",
        exp: 0,
        nextExp: 50,
        prevExp: 0,
        expProgress: 0,
      });
    }
  }

  return result;
}