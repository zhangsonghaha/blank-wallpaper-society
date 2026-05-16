import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// 缓存
let recommendationsCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

// GET /api/recommendations?userId=1&limit=20
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // 检查缓存
    const cacheKey = `rec_${userId || "anon"}_${limit}`;
    const cached = recommendationsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(
        { data: cached.data, cached: true },
        { headers: { "Cache-Control": "public, s-maxage=1800" } }
      );
    }

    let recommendations: any[] = [];

    if (userId) {
      // 已登录用户：基于收藏分类偏好 + 热门趋势混合推荐
      recommendations = await getPersonalizedRecommendations(parseInt(userId), limit);
    } else {
      // 未登录：纯热门趋势推荐
      recommendations = await getTrendingRecommendations(limit);
    }

    // 更新缓存
    recommendationsCache[cacheKey] = { data: recommendations, timestamp: Date.now() };

    return NextResponse.json(
      { data: recommendations, cached: false },
      { headers: { "Cache-Control": "public, s-maxage=1800" } }
    );
  } catch (error: any) {
    console.error("获取推荐失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}

// 个性化推荐：基于用户收藏分类偏好 + 热门趋势
async function getPersonalizedRecommendations(userId: number, limit: number): Promise<any[]> {
  // 1. 获取用户收藏图片的分类偏好
  const categoryPrefs = (await query(
    `SELECT category, COUNT(*) AS cnt 
     FROM images 
     WHERE is_favorite = 1 AND id IN (
       SELECT image_id FROM download_logs WHERE user_id = ? 
       UNION 
       SELECT image_id FROM view_logs WHERE user_id = ?
     )
     AND category IS NOT NULL
     GROUP BY category 
     ORDER BY cnt DESC 
     LIMIT 5`,
    [userId, userId]
  )) as any[];

  const preferredCategories = categoryPrefs.map((r: any) => r.category);

  if (preferredCategories.length === 0) {
    // 没有偏好数据，走热门推荐
    return getTrendingRecommendations(limit);
  }

  // 2. 基于偏好分类推荐（权重60%）
  const categoryPlaceholders = preferredCategories.map(() => "?").join(",");
  const preferredImages = (await query(
    `SELECT i.id, i.title, i.description, i.url, i.thumbnail_url, 
            i.width, i.height, i.author, i.tags, i.category,
            i.download_count, i.view_count
     FROM images i
     WHERE i.status = 'approved' 
       AND i.category IN (${categoryPlaceholders})
     ORDER BY i.download_count DESC, i.view_count DESC
     LIMIT ?`,
    [...preferredCategories, Math.ceil(limit * 0.6)]
  )) as any[];

  // 3. 热门趋势补充（权重40%）
  const trendingImages = (await query(
    `SELECT i.id, i.title, i.description, i.url, i.thumbnail_url, 
            i.width, i.height, i.author, i.tags, i.category,
            i.download_count, i.view_count
     FROM images i
     WHERE i.status = 'approved'
     ORDER BY i.download_count DESC, i.view_count DESC
     LIMIT ?`,
    [Math.ceil(limit * 0.4)]
  )) as any[];

  // 4. 合并去重 + 推荐理由
  const seen = new Set<number>();
  const result: any[] = [];

  for (const img of preferredImages) {
    if (!seen.has(img.id) && result.length < limit) {
      seen.add(img.id);
      result.push({
        ...img,
        reason: `因为你喜欢「${img.category}」类壁纸`,
        reasonType: "category_preference",
      });
    }
  }

  for (const img of trendingImages) {
    if (!seen.has(img.id) && result.length < limit) {
      seen.add(img.id);
      result.push({
        ...img,
        reason: "热门推荐",
        reasonType: "trending",
      });
    }
  }

  return result;
}

// 热门趋势推荐
async function getTrendingRecommendations(limit: number): Promise<any[]> {
  // 综合下载量、浏览量、近期活跃度
  const rows = (await query(
    `SELECT i.id, i.title, i.description, i.url, i.thumbnail_url, 
            i.width, i.height, i.author, i.tags, i.category,
            i.download_count, i.view_count,
            (i.download_count * 3 + i.view_count) AS trending_score
     FROM images i
     WHERE i.status = 'approved'
     ORDER BY trending_score DESC
     LIMIT ?`,
    [limit]
  )) as any[];

  return rows.map((img: any) => ({
    ...img,
    reason: "热门推荐",
    reasonType: "trending",
  }));
}