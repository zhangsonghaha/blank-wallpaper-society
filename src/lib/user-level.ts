import { query, getConnection } from "@/lib/db";
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
  const rows = await query("SELECT id FROM user_levels WHERE user_id = ?", [userId]) as any[];
  if (rows.length === 0) {
    await query("INSERT INTO user_levels (user_id, level, exp, title) VALUES (?, 1, 0, '新手')", [userId]);
  }
}

// === 增加经验值（使用事务） ===
export async function addExp(userId: number, amount: number): Promise<LevelInfo> {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // 确保记录存在
    const [rows] = await conn.execute("SELECT id, exp FROM user_levels WHERE user_id = ? FOR UPDATE", [userId]) as [any[], any];
    
    let currentExp: number;
    if (rows.length === 0) {
      currentExp = 0;
      await conn.execute("INSERT INTO user_levels (user_id, level, exp, title) VALUES (?, 1, 0, '新手')", [userId]);
    } else {
      currentExp = rows[0].exp;
    }

    const newExp = currentExp + amount;
    const levelInfo = calculateLevel(newExp);

    await conn.execute(
      "UPDATE user_levels SET exp = ?, level = ?, title = ? WHERE user_id = ?",
      [newExp, levelInfo.level, levelInfo.title, userId]
    );

    await conn.commit();

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
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// === 获取用户统计数据 ===
export async function getUserStats(userId: number): Promise<UserStats> {
  // 上传数
  const uploadRows = await query(
    "SELECT COUNT(*) as count FROM images WHERE uploaded_by = ?",
    [userId]
  ) as any[];
  const uploadCount = uploadRows[0]?.count || 0;

  // 下载总数（用户上传的图片被下载的总次数）
  const downloadRows = await query(
    "SELECT COALESCE(SUM(download_count), 0) as count FROM images WHERE uploaded_by = ?",
    [userId]
  ) as any[];
  const downloadCount = downloadRows[0]?.count || 0;

  // 被收藏总数（用户上传的图片被收藏的总次数）
  const favoriteRows = await query(
    `SELECT COUNT(*) as count FROM favorites f INNER JOIN images i ON f.image_id = i.id WHERE i.uploaded_by = ?`,
    [userId]
  ) as any[];
  const favoriteCount = favoriteRows[0]?.count || 0;

  // 粉丝数
  const followerRows = await query(
    "SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?",
    [userId]
  ) as any[];
  const followerCount = followerRows[0]?.count || 0;

  // 关注数
  const followingRows = await query(
    "SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?",
    [userId]
  ) as any[];
  const followingCount = followingRows[0]?.count || 0;

  // 用户收藏的图片数（收藏达人成就用）
  const collectionRows = await query(
    "SELECT COUNT(*) as count FROM favorites WHERE user_id = ?",
    [userId]
  ) as any[];
  const collectionCount = collectionRows[0]?.count || 0;

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
    const allAchievements = await query("SELECT * FROM achievements") as any[];

    // 获取已解锁的成就
    const unlockedRows = await query(
      "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?",
      [userId]
    ) as any[];
    const unlockedSet = new Set(unlockedRows.map((r: any) => r.achievement_id));
    const unlockedAtMap = new Map(unlockedRows.map((r: any) => [r.achievement_id, r.unlocked_at]));

    const newlyUnlocked: Achievement[] = [];

    for (const ach of allAchievements) {
      const currentValue = statsMap[ach.condition_type] ?? 0;
      const met = currentValue >= ach.condition_value;

      if (met && !unlockedSet.has(ach.id)) {
        // 解锁成就
        await query(
          "INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)",
          [userId, ach.id]
        );
        // 成就经验奖励
        await addExp(userId, ach.exp_reward);

        // 推送成就解锁通知
        await notifyAchievementUnlocked(userId, ach.name, ach.id, ach.exp_reward);

        newlyUnlocked.push({
          id: ach.id,
          slug: ach.slug,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
          category: ach.category,
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

  const rows = await query("SELECT * FROM user_levels WHERE user_id = ?", [userId]) as any[];
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
  const allAchievements = await query("SELECT * FROM achievements ORDER BY category, condition_value") as any[];

  // 已解锁
  const unlockedRows = await query(
    "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?",
    [userId]
  ) as any[];
  const unlockedAtMap = new Map(unlockedRows.map((r: any) => [r.achievement_id, r.unlocked_at]));

  return allAchievements.map((ach: any) => {
    const currentValue = statsMap[ach.condition_type] ?? 0;
    const progress = Math.min(currentValue / ach.condition_value, 1);
    const unlocked = unlockedAtMap.has(ach.id);

    return {
      id: ach.id,
      slug: ach.slug,
      name: ach.name,
      description: ach.description,
      icon: ach.icon,
      category: ach.category,
      conditionType: ach.condition_type,
      conditionValue: ach.condition_value,
      expReward: ach.exp_reward,
      unlocked,
      unlockedAt: unlockedAtMap.get(ach.id)?.toISOString?.() || unlockedAtMap.get(ach.id),
      progress,
      currentValue,
    };
  });
}

// === 获取多个用户的等级信息（批量） ===
export async function getUserLevelsBatch(userIds: number[]): Promise<Map<number, LevelInfo>> {
  if (userIds.length === 0) return new Map();

  const placeholders = userIds.map(() => "?").join(",");
  const rows = await query(
    `SELECT * FROM user_levels WHERE user_id IN (${placeholders})`,
    userIds
  ) as any[];

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