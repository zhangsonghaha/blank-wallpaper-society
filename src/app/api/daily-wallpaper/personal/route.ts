import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sql } from "kysely";

// GET /api/daily-wallpaper/personal - 基于用户偏好的个性化每日推荐
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 1. 统计用户收藏图片的分类偏好
    const categoryPrefs = await db
      .selectFrom("favorites as f")
      .innerJoin("images as i", "i.id", "f.image_id")
      .select([
        "i.category",
        (eb: any) => eb.fn.count("i.id").as("cnt"),
      ])
      .where("f.user_id", "=", userId)
      .where("i.category", "is not", null)
      .where("i.category", "!=", "")
      .groupBy("i.category")
      .orderBy("cnt", "desc")
      .limit(5)
      .execute();

    // 2. 统计用户收藏图片的标签偏好
    const tagPrefs = await db
      .selectFrom("favorites as f")
      .innerJoin("images as i", "i.id", "f.image_id")
      .select("i.tags")
      .where("f.user_id", "=", userId)
      .where("i.tags", "is not", null)
      .where("i.tags", "!=", "")
      .limit(100)
      .execute();

    // 提取并统计标签频率
    const tagCounts: Record<string, number> = {};
    for (const row of tagPrefs) {
      if (row.tags) {
        const tags = (row.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean);
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    // 3. 获取用户已收藏的图片 ID（用于排除）
    const favoritedIds = await db
      .selectFrom("favorites")
      .select("image_id")
      .where("user_id", "=", userId)
      .execute();
    const excludeIds = favoritedIds.map((r) => r.image_id);

    // 4. 基于偏好查询推荐图片
    let recommendedImages: any[] = [];

    if (categoryPrefs.length > 0) {
      // 按偏好分类权重查询
      const categories = categoryPrefs.map((c: any) => c.category);

      // 构建标签 LIKE 条件
      const tagConditions = topTags.length > 0
        ? sql` OR ${sql.join(topTags.map((tag) => sql`i.tags LIKE ${`%${tag}%`}`))}`
        : sql``;

      const excludeList = excludeIds.length > 0
        ? sql`AND i.id NOT IN (${sql.join(excludeIds)})`
        : sql`AND i.id NOT IN (0)`;

      const recResult = await sql`
        SELECT i.id, i.title, i.description, i.url, i.thumbnail_url,
               i.width, i.height, i.category, i.tags, i.author,
               i.view_count, i.download_count, i.favorite_count,
               i.created_at, i.dominant_color, i.media_type, i.video_url
        FROM images i
        WHERE i.status = 'approved'
          ${excludeList}
          AND (i.category IN (${sql.join(categories)})${tagConditions})
        ORDER BY COALESCE(i.favorite_count, 0) * 5 + COALESCE(i.download_count, 0) * 2 + COALESCE(i.view_count, 0) * 0.1 DESC
        LIMIT 20
      `.execute(db);
      recommendedImages = (recResult as any).rows;
    }

    // 5. 如果偏好推荐不够，补充热门图片
    if (recommendedImages.length < 5) {
      const existingIds = new Set(recommendedImages.map((img: any) => img.id));
      const allExcludeIds = [...excludeIds, ...Array.from(existingIds)];
      const excludeList = allExcludeIds.length > 0
        ? sql`AND id NOT IN (${sql.join(allExcludeIds)})`
        : sql`AND id NOT IN (0)`;
      const needed = 10 - recommendedImages.length;

      const fallbackResult = await sql`
        SELECT id, title, description, url, thumbnail_url,
                width, height, category, tags, author,
                view_count, download_count, favorite_count,
                created_at, dominant_color, media_type, video_url
         FROM images
         WHERE status = 'approved'
           ${excludeList}
         ORDER BY COALESCE(favorite_count, 0) * 5 + COALESCE(download_count, 0) * 2 + COALESCE(view_count, 0) * 0.1 DESC
         LIMIT ${needed}
      `.execute(db);
      const fallbackImages = (fallbackResult as any).rows;

      recommendedImages = [...recommendedImages, ...fallbackImages];
    }

    // 6. 使用日期 seed 从候选中选取 5 张
    const today = new Date().toISOString().split("T")[0];
    const seed = hashCode(today + String(userId));
    const selected = seededPick(recommendedImages, seed, 5);

    return NextResponse.json({
      success: true,
      date: today,
      recommendations: selected,
      preferences: {
        categories: categoryPrefs.map((c: any) => ({
          name: c.category,
          count: Number(c.cnt),
        })),
        tags: topTags.slice(0, 5),
      },
    });
  } catch (error: any) {
    console.error("GET /api/daily-wallpaper/personal error:", error);
    return NextResponse.json(
      { error: error.message || "获取个性化推荐失败" },
      { status: 500 }
    );
  }
}

/** 简单 hash 函数 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/** 基于种子选取指定数量的图片 */
function seededPick(images: any[], seed: number, count: number): any[] {
  if (images.length <= count) return images;

  let s = seed;
  const nextRandom = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };

  const selected: any[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    let idx = Math.floor(nextRandom() * images.length);
    let attempts = 0;
    while (usedIndices.has(idx) && attempts < 100) {
      idx = Math.floor(nextRandom() * images.length);
      attempts++;
    }
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      selected.push(images[idx]);
    }
  }

  return selected;
}
