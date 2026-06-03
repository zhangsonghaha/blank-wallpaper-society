import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET /api/users/[id]/profile - 获取用户公开主页信息（不需要登录）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    // 获取用户基本信息
    const users = await db
      .selectFrom("users")
      .select([
        "id",
        "name",
        "avatar",
        "banner",
        "bio",
        "social_links",
        "featured_collections",
        "is_verified",
        "role",
        "created_at",
      ])
      .where("id", "=", userId)
      .execute();

    if (users.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const user = users[0];

    // 解析 JSON 字段
    let socialLinks = null;
    let featuredCollections: number[] = [];
    try {
      socialLinks = user.social_links
        ? typeof user.social_links === "string"
          ? JSON.parse(user.social_links)
          : user.social_links
        : null;
    } catch {
      socialLinks = null;
    }
    try {
      featuredCollections = user.featured_collections
        ? typeof user.featured_collections === "string"
          ? JSON.parse(user.featured_collections)
          : (user.featured_collections as number[])
        : [];
      if (!Array.isArray(featuredCollections)) featuredCollections = [];
    } catch {
      featuredCollections = [];
    }

    // 获取统计数据
    const statsRows = await sql<{
      totalImages: number;
      totalViews: number;
      totalDownloads: number;
      totalFavorites: number;
    }>`
      SELECT
        COUNT(*) as totalImages,
        COALESCE(SUM(view_count), 0) as totalViews,
        COALESCE(SUM(download_count), 0) as totalDownloads,
        COALESCE(SUM(favorite_count), 0) as totalFavorites
      FROM images WHERE uploaded_by = ${userId} AND status = 'approved'
    `.execute(db);
    const stats = statsRows.rows[0];

    // 获取粉丝/关注数
    const followStatsRows = await sql<{ followers: number; following: number }>`
      SELECT
        (SELECT COUNT(*) FROM user_follows WHERE following_id = ${userId}) as followers,
        (SELECT COUNT(*) FROM user_follows WHERE follower_id = ${userId}) as following
    `.execute(db);
    const followStats = followStatsRows.rows[0];

    // 获取精选合集详情
    let featuredCollectionDetails: any[] = [];
    if (featuredCollections.length > 0) {
      const validIds = featuredCollections.filter(
        (id: any) => !isNaN(Number(id))
      );
      if (validIds.length > 0) {
        const idList = sql.join(
          validIds.map((id: any) => sql`${Number(id)}`)
        );
        const collRows = await sql<any>`
          SELECT c.id, c.title as name, c.description, c.is_public,
            i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
            (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
            (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
          FROM collections c
          LEFT JOIN images i ON c.cover_image_id = i.id
          WHERE c.id IN (${idList}) AND c.is_public = 1
        `.execute(db);
        featuredCollectionDetails = collRows.rows;
        // 按用户指定的顺序排列
        featuredCollectionDetails.sort((a: any, b: any) => {
          return (
            featuredCollections.indexOf(a.id) -
            featuredCollections.indexOf(b.id)
          );
        });
      }
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      banner: user.banner || null,
      bio: user.bio || null,
      social_links: socialLinks,
      is_verified: user.is_verified,
      role: user.role,
      createdAt: user.created_at,
      stats: {
        totalImages: stats?.totalImages || 0,
        totalViews: stats?.totalViews || 0,
        totalDownloads: stats?.totalDownloads || 0,
        totalFavorites: stats?.totalFavorites || 0,
      },
      followers: followStats?.followers || 0,
      following: followStats?.following || 0,
      featured_collections: featuredCollectionDetails,
    });
  } catch (error: any) {
    console.error("GET /api/users/[id]/profile error:", error);
    return NextResponse.json(
      { error: error.message || "获取失败" },
      { status: 500 }
    );
  }
}
