import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { getOrSet, CacheKeys, CacheTTL } from "@/lib/redis";

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
        // 热门排行（Redis 缓存）
        const trendResult = await getOrSet(
          CacheKeys.FEED_TRENDING(page, limit),
          () => getTrendingFeed(limit, offset),
          CacheTTL.FEED_TRENDING
        );
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
          // 未登录走热门（Redis 缓存）
          const trendResult2 = await getOrSet(
            CacheKeys.FEED_TRENDING(page, limit),
            () => getTrendingFeed(limit, offset),
            CacheTTL.FEED_TRENDING
          );
          images = trendResult2.images;
          total = trendResult2.total;
        }
        break;
    }

    // 为每张图片附加用户交互状态（是否已收藏）
    if (userId && images.length > 0) {
      const imageIds = images.map((img: any) => img.id);
      const favorites = await db
        .selectFrom("favorites")
        .select(["image_id"])
        .where("user_id", "=", userId)
        .where("image_id", "in", imageIds)
        .execute();
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
  const countRows = await db
    .selectFrom("images as i")
    .innerJoin("user_follows as uf", "uf.following_id", "i.uploaded_by")
    .select((eb) => [eb.fn.countAll().as("total")])
    .where("uf.follower_id", "=", userId)
    .where("i.status", "=", "approved")
    .execute();

  const images = await db
    .selectFrom("images as i")
    .innerJoin("user_follows as uf", "uf.following_id", "i.uploaded_by")
    .leftJoin("users as u", "u.id", "i.uploaded_by")
    .select([
      "i.id", "i.title", "i.url", "i.thumbnail_url", "i.width", "i.height",
      "i.description", "i.category", "i.tags", "i.filename", "i.storage_key",
      "i.file_size", "i.mime_type", "i.source_type", "i.status",
      "i.download_count", "i.view_count", "i.favorite_count",
      "i.dominant_color", "i.color_palette", "i.phash",
      "i.uploaded_by", "i.author", "i.media_type", "i.video_url", "i.poster_url",
      "i.exif", "i.nsfw_flagged", "i.nsfw_score", "i.thumbnails", "i.variants",
      "i.reject_reason", "i.reviewed_at", "i.reviewed_by",
      "i.created_at", "i.updated_at",
      sql<string | null>`u.name`.as("author_name"),
      sql<string | null>`u.avatar`.as("author_avatar"),
    ])
    .where("uf.follower_id", "=", userId)
    .where("i.status", "=", "approved")
    .orderBy("i.created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return { images, total: Number(countRows[0]?.total ?? 0) };
}

// === 推荐Feed（基于收藏偏好 + 热门混合） ===
async function getRecommendedFeed(userId: number, limit: number, offset: number) {
  // 获取用户收藏的分类偏好
  const categoryPrefs = await db
    .selectFrom("favorites as f")
    .innerJoin("images as i", "i.id", "f.image_id")
    .select([
      "i.category",
      sql<number>`COUNT(*)`.as("cnt"),
    ])
    .where("f.user_id", "=", userId)
    .where("i.category", "is not", null)
    .where("i.category", "!=", "")
    .groupBy("i.category")
    .orderBy("cnt", "desc")
    .limit(5)
    .execute();

  const preferredCategories = categoryPrefs.map((r: any) => r.category).filter(Boolean);

  if (preferredCategories.length === 0) {
    // 没有偏好数据，走热门
    return getTrendingFeed(limit, offset);
  }

  // 基于偏好分类推荐
  const countRows = await db
    .selectFrom("images as i")
    .select((eb) => [eb.fn.countAll().as("total")])
    .where("i.status", "=", "approved")
    .where("i.category", "in", preferredCategories)
    .execute();

  const images = await db
    .selectFrom("images as i")
    .leftJoin("users as u", "u.id", "i.uploaded_by")
    .select([
      "i.id", "i.title", "i.url", "i.thumbnail_url", "i.width", "i.height",
      "i.description", "i.category", "i.tags", "i.filename", "i.storage_key",
      "i.file_size", "i.mime_type", "i.source_type", "i.status",
      "i.download_count", "i.view_count", "i.favorite_count",
      "i.dominant_color", "i.color_palette", "i.phash",
      "i.uploaded_by", "i.author", "i.media_type", "i.video_url", "i.poster_url",
      "i.exif", "i.nsfw_flagged", "i.nsfw_score", "i.thumbnails", "i.variants",
      "i.reject_reason", "i.reviewed_at", "i.reviewed_by",
      "i.created_at", "i.updated_at",
      sql<string | null>`u.name`.as("author_name"),
      sql<string | null>`u.avatar`.as("author_avatar"),
    ])
    .where("i.status", "=", "approved")
    .where("i.category", "in", preferredCategories)
    .orderBy("i.download_count", "desc")
    .orderBy("i.view_count", "desc")
    .orderBy("i.created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return { images, total: Number(countRows[0]?.total ?? 0) };
}

// === 热门Feed ===
async function getTrendingFeed(limit: number, offset: number) {
  const countRows = await db
    .selectFrom("images")
    .select((eb) => [eb.fn.countAll().as("total")])
    .where("status", "=", "approved")
    .execute();

  const images = await db
    .selectFrom("images as i")
    .leftJoin("users as u", "u.id", "i.uploaded_by")
    .select([
      "i.id", "i.title", "i.url", "i.thumbnail_url", "i.width", "i.height",
      "i.description", "i.category", "i.tags", "i.filename", "i.storage_key",
      "i.file_size", "i.mime_type", "i.source_type", "i.status",
      "i.download_count", "i.view_count", "i.favorite_count",
      "i.dominant_color", "i.color_palette", "i.phash",
      "i.uploaded_by", "i.author", "i.media_type", "i.video_url", "i.poster_url",
      "i.exif", "i.nsfw_flagged", "i.nsfw_score", "i.thumbnails", "i.variants",
      "i.reject_reason", "i.reviewed_at", "i.reviewed_by",
      "i.created_at", "i.updated_at",
      sql<string | null>`u.name`.as("author_name"),
      sql<string | null>`u.avatar`.as("author_avatar"),
      sql<number>`(i.download_count * 3 + i.view_count)`.as("trending_score"),
    ])
    .where("i.status", "=", "approved")
    .orderBy("trending_score", "desc")
    .orderBy("i.created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return { images, total: Number(countRows[0]?.total ?? 0) };
}

// === 混合Feed（关注40% + 推荐30% + 热门30%） ===
async function getMixedFeed(userId: number, limit: number, offset: number) {
  // 简单策略：从三个源各取一定数量，合并去重后返回
  const followingCount = Math.ceil(limit * 0.4);
  const recommendedCount = Math.ceil(limit * 0.3);
  const trendingCount = limit - followingCount - recommendedCount;

  // 获取关注者的图片
  const followingImages = await db
    .selectFrom("images as i")
    .innerJoin("user_follows as uf", "uf.following_id", "i.uploaded_by")
    .leftJoin("users as u", "u.id", "i.uploaded_by")
    .select([
      "i.id", "i.title", "i.url", "i.thumbnail_url", "i.width", "i.height",
      "i.description", "i.category", "i.tags", "i.filename", "i.storage_key",
      "i.file_size", "i.mime_type", "i.source_type", "i.status",
      "i.download_count", "i.view_count", "i.favorite_count",
      "i.dominant_color", "i.color_palette", "i.phash",
      "i.uploaded_by", "i.author", "i.media_type", "i.video_url", "i.poster_url",
      "i.exif", "i.nsfw_flagged", "i.nsfw_score", "i.thumbnails", "i.variants",
      "i.reject_reason", "i.reviewed_at", "i.reviewed_by",
      "i.created_at", "i.updated_at",
      sql<string | null>`u.name`.as("author_name"),
      sql<string | null>`u.avatar`.as("author_avatar"),
      sql<string>`'following'`.as("feed_source"),
    ])
    .where("uf.follower_id", "=", userId)
    .where("i.status", "=", "approved")
    .orderBy("i.created_at", "desc")
    .limit(followingCount + offset)
    .execute();

  // 获取推荐图片（基于分类偏好，排除关注者）
  const categoryPrefs = await db
    .selectFrom("favorites as f")
    .innerJoin("images as i", "i.id", "f.image_id")
    .select([
      "i.category",
      sql<number>`COUNT(*)`.as("cnt"),
    ])
    .where("f.user_id", "=", userId)
    .where("i.category", "is not", null)
    .where("i.category", "!=", "")
    .groupBy("i.category")
    .orderBy("cnt", "desc")
    .limit(5)
    .execute();

  const preferredCategories = categoryPrefs.map((r: any) => r.category).filter(Boolean);
  let recommendedImages: any[] = [];

  if (preferredCategories.length > 0) {
    recommendedImages = await db
      .selectFrom("images as i")
      .leftJoin("users as u", "u.id", "i.uploaded_by")
      .select([
        "i.id", "i.title", "i.url", "i.thumbnail_url", "i.width", "i.height",
        "i.description", "i.category", "i.tags", "i.filename", "i.storage_key",
        "i.file_size", "i.mime_type", "i.source_type", "i.status",
        "i.download_count", "i.view_count", "i.favorite_count",
        "i.dominant_color", "i.color_palette", "i.phash",
        "i.uploaded_by", "i.author", "i.media_type", "i.video_url", "i.poster_url",
        "i.exif", "i.nsfw_flagged", "i.nsfw_score", "i.thumbnails", "i.variants",
        "i.reject_reason", "i.reviewed_at", "i.reviewed_by",
        "i.created_at", "i.updated_at",
        sql<string | null>`u.name`.as("author_name"),
        sql<string | null>`u.avatar`.as("author_avatar"),
        sql<string>`'recommended'`.as("feed_source"),
      ])
      .where("i.status", "=", "approved")
      .where("i.category", "in", preferredCategories)
      .orderBy("i.download_count", "desc")
      .orderBy("i.created_at", "desc")
      .limit(recommendedCount + offset)
      .execute();
  }

  // 获取热门图片
  const trendingImages = await db
    .selectFrom("images as i")
    .leftJoin("users as u", "u.id", "i.uploaded_by")
    .select([
      "i.id", "i.title", "i.url", "i.thumbnail_url", "i.width", "i.height",
      "i.description", "i.category", "i.tags", "i.filename", "i.storage_key",
      "i.file_size", "i.mime_type", "i.source_type", "i.status",
      "i.download_count", "i.view_count", "i.favorite_count",
      "i.dominant_color", "i.color_palette", "i.phash",
      "i.uploaded_by", "i.author", "i.media_type", "i.video_url", "i.poster_url",
      "i.exif", "i.nsfw_flagged", "i.nsfw_score", "i.thumbnails", "i.variants",
      "i.reject_reason", "i.reviewed_at", "i.reviewed_by",
      "i.created_at", "i.updated_at",
      sql<string | null>`u.name`.as("author_name"),
      sql<string | null>`u.avatar`.as("author_avatar"),
      sql<string>`'trending'`.as("feed_source"),
      sql<number>`(i.download_count * 3 + i.view_count)`.as("trending_score"),
    ])
    .where("i.status", "=", "approved")
    .orderBy("trending_score", "desc")
    .orderBy("i.created_at", "desc")
    .limit(trendingCount + offset)
    .execute();

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
