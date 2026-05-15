import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/feed - 混合Feed流
// 支持类型：all（默认，三源混合）、following（仅关注）、recommended（推荐）、trending（热门）
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user ? (session.user as any).id : null;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const feedType = searchParams.get("type") || "all"; // all / following / recommended / trending

    let images: any[] = [];
    let total = 0;

    switch (feedType) {
      case "following":
        // 仅关注者的图片
        if (!userId) {
          return NextResponse.json({ error: "请先登录" }, { status: 401 });
        }
        const followingResult = await getFollowingFeed(userId, limit, offset);
        images = followingResult.images;
        total = followingResult.total;
        break;

      case "recommended":
        // 个性化推荐
        const recResult = userId
          ? await getRecommendedFeed(userId, limit, offset)
          : await getTrendingFeed(limit, offset);
        images = recResult.images;
        total = recResult.total;
        break;

      case "trending":
        // 热门排行
        const trendResult = await getTrendingFeed(limit, offset);
        images = trendResult.images;
        total = trendResult.total;
        break;

      case "all":
      default:
        // 混合Feed：关注 + 推荐 + 热门
        if (userId) {
          const mixResult = await getMixedFeed(userId, limit, offset);
          images = mixResult.images;
          total = mixResult.total;
        } else {
          // 未登录走热门
          const trendResult2 = await getTrendingFeed(limit, offset);
          images = trendResult2.images;
          total = trendResult2.total;
        }
        break;
    }

    // 为每张图片附加用户交互状态（是否已收藏）
    if (userId && images.length > 0) {
      const imageIds = images.map((img: any) => img.id);
      const placeholders = imageIds.map(() => "?").join(",");
      const favorites = await query(
        `SELECT image_id FROM favorites WHERE user_id = ? AND image_id IN (${placeholders})`,
        [userId, ...imageIds]
      ) as any[];
      const favoriteSet = new Set(favorites.map((f: any) => f.image_id));
      images = images.map((img: any) => ({
        ...img,
        is_favorited: favoriteSet.has(img.id),
      }));
    }

    return NextResponse.json({
      data: images,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      feedType,
    });
  } catch (error: any) {
    console.error("GET /api/feed error:", error);
    return NextResponse.json(
      { error: error.message || "获取失败" },
      { status: 500 }
    );
  }
}

// === 关注者Feed ===
async function getFollowingFeed(userId: number, limit: number, offset: number) {
  const countRows = (await query(
    `SELECT COUNT(*) AS total FROM images i
     INNER JOIN user_follows uf ON i.uploaded_by = uf.following_id
     WHERE uf.follower_id = ? AND i.status = 'approved'`,
    [userId]
  )) as any[];

  const images = (await query(
    `SELECT i.*, u.name as author_name, u.avatar as author_avatar
     FROM images i
     INNER JOIN user_follows uf ON i.uploaded_by = uf.following_id
     LEFT JOIN users u ON i.uploaded_by = u.id
     WHERE uf.follower_id = ? AND i.status = 'approved'
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  )) as any[];

  return { images, total: countRows[0]?.total || 0 };
}

// === 推荐Feed（基于收藏偏好 + 热门混合） ===
async function getRecommendedFeed(userId: number, limit: number, offset: number) {
  // 获取用户收藏的分类偏好
  const categoryPrefs = (await query(
    `SELECT i.category, COUNT(*) AS cnt
     FROM favorites f
     INNER JOIN images i ON f.image_id = i.id
     WHERE f.user_id = ? AND i.category IS NOT NULL AND i.category != ''
     GROUP BY i.category
     ORDER BY cnt DESC LIMIT 5`,
    [userId]
  )) as any[];

  const preferredCategories = categoryPrefs.map((r: any) => r.category);

  let images: any[];
  let total: number;

  if (preferredCategories.length === 0) {
    // 没有偏好数据，走热门
    return getTrendingFeed(limit, offset);
  }

  // 基于偏好分类推荐
  const categoryPlaceholders = preferredCategories.map(() => "?").join(",");
  const countRows = (await query(
    `SELECT COUNT(*) AS total FROM images i
     WHERE i.status = 'approved' AND i.category IN (${categoryPlaceholders})`,
    [...preferredCategories]
  )) as any[];

  images = (await query(
    `SELECT i.*, u.name as author_name, u.avatar as author_avatar
     FROM images i
     LEFT JOIN users u ON i.uploaded_by = u.id
     WHERE i.status = 'approved' AND i.category IN (${categoryPlaceholders})
     ORDER BY i.download_count DESC, i.view_count DESC, i.created_at DESC
     LIMIT ? OFFSET ?`,
    [...preferredCategories, limit, offset]
  )) as any[];

  return { images, total: countRows[0]?.total || 0 };
}

// === 热门Feed ===
async function getTrendingFeed(limit: number, offset: number) {
  const countRows = (await query(
    `SELECT COUNT(*) AS total FROM images WHERE status = 'approved'`
  )) as any[];

  const images = (await query(
    `SELECT i.*, u.name as author_name, u.avatar as author_avatar,
            (i.download_count * 3 + i.view_count) AS trending_score
     FROM images i
     LEFT JOIN users u ON i.uploaded_by = u.id
     WHERE i.status = 'approved'
     ORDER BY trending_score DESC, i.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  )) as any[];

  return { images, total: countRows[0]?.total || 0 };
}

// === 混合Feed（关注40% + 推荐30% + 热门30%） ===
async function getMixedFeed(userId: number, limit: number, offset: number) {
  // 简单策略：从三个源各取一定数量，合并去重后返回
  const followingCount = Math.ceil(limit * 0.4);
  const recommendedCount = Math.ceil(limit * 0.3);
  const trendingCount = limit - followingCount - recommendedCount;

  // 获取关注者的图片
  const followingImages = (await query(
    `SELECT i.*, u.name as author_name, u.avatar as author_avatar, 'following' as feed_source
     FROM images i
     INNER JOIN user_follows uf ON i.uploaded_by = uf.following_id
     LEFT JOIN users u ON i.uploaded_by = u.id
     WHERE uf.follower_id = ? AND i.status = 'approved'
     ORDER BY i.created_at DESC
     LIMIT ?`,
    [userId, followingCount + offset]
  )) as any[];

  // 获取推荐图片（基于分类偏好，排除关注者）
  const categoryPrefs = (await query(
    `SELECT i.category, COUNT(*) AS cnt
     FROM favorites f
     INNER JOIN images i ON f.image_id = i.id
     WHERE f.user_id = ? AND i.category IS NOT NULL AND i.category != ''
     GROUP BY i.category
     ORDER BY cnt DESC LIMIT 5`,
    [userId]
  )) as any[];

  const preferredCategories = categoryPrefs.map((r: any) => r.category);
  let recommendedImages: any[] = [];

  if (preferredCategories.length > 0) {
    const categoryPlaceholders = preferredCategories.map(() => "?").join(",");
    recommendedImages = (await query(
      `SELECT i.*, u.name as author_name, u.avatar as author_avatar, 'recommended' as feed_source
       FROM images i
       LEFT JOIN users u ON i.uploaded_by = u.id
       WHERE i.status = 'approved' AND i.category IN (${categoryPlaceholders})
       ORDER BY i.download_count DESC, i.created_at DESC
       LIMIT ?`,
      [...preferredCategories, recommendedCount + offset]
    )) as any[];
  }

  // 获取热门图片
  const trendingImages = (await query(
    `SELECT i.*, u.name as author_name, u.avatar as author_avatar, 'trending' as feed_source,
            (i.download_count * 3 + i.view_count) AS trending_score
     FROM images i
     LEFT JOIN users u ON i.uploaded_by = u.id
     WHERE i.status = 'approved'
     ORDER BY trending_score DESC, i.created_at DESC
     LIMIT ?`,
    [trendingCount + offset]
  )) as any[];

  // 合并去重，优先级：following > recommended > trending
  const seen = new Set<number>();
  const result: any[] = [];

  for (const img of [...followingImages, ...recommendedImages, ...trendingImages]) {
    if (!seen.has(img.id)) {
      seen.add(img.id);
      result.push(img);
    }
  }

  // 按创建时间排序
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // 分页
  const total = result.length;
  const paginatedResult = result.slice(offset, offset + limit);

  return { images: paginatedResult, total: Math.max(total, offset + limit) };
}