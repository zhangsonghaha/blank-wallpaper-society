import { db } from "@/lib/db";
import { sql } from "kysely";
import { notFound } from "next/navigation";
import { getUserLevel } from "@/lib/user-level";
import UserClient from "./UserClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return { title: "用户主页" };

  const user = await db
    .selectFrom("users")
    .select(["id", "name", "bio"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) return { title: "用户不存在" };

  return {
    title: `${user.name} - 用户主页`,
    description: user.bio || `${user.name}的壁纸主页`,
  };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) notFound();

  // 获取用户基本信息
  const user = await db
    .selectFrom("users")
    .select([
      "id", "name", "avatar", "banner", "bio", "social_links",
      "featured_collections", "is_verified", "role", "created_at",
    ])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) notFound();

  // 解析 JSON 字段
  let socialLinks = null;
  let featuredCollections: number[] = [];
  try {
    socialLinks = user.social_links ? (typeof user.social_links === "string" ? JSON.parse(user.social_links) : user.social_links) : null;
  } catch { socialLinks = null; }
  try {
    featuredCollections = user.featured_collections ? (typeof user.featured_collections === "string" ? JSON.parse(user.featured_collections) : user.featured_collections) : [];
    if (!Array.isArray(featuredCollections)) featuredCollections = [];
  } catch { featuredCollections = []; }

  // 统计数据
  const stats = await db
    .selectFrom("images")
    .select((eb) => [
      eb.fn.countAll().as("totalImages"),
      eb.fn.coalesce(eb.fn.sum("view_count"), eb.val(0)).as("totalViews"),
      eb.fn.coalesce(eb.fn.sum("download_count"), eb.val(0)).as("totalDownloads"),
      eb.fn.coalesce(eb.fn.sum("favorite_count"), eb.val(0)).as("totalFavorites"),
    ])
    .where("uploaded_by", "=", userId)
    .where("status", "=", "approved")
    .executeTakeFirst();

  // 粉丝/关注数
  const followStats = await sql<{ followers: number; following: number }>`
    SELECT
      (SELECT COUNT(*) FROM user_follows WHERE following_id = ${userId}) as followers,
      (SELECT COUNT(*) FROM user_follows WHERE follower_id = ${userId}) as following
  `.execute(db).then(r => r.rows[0]);

  // 精选合集详情
  let featuredCollectionDetails: any[] = [];
  if (featuredCollections.length > 0) {
    const validIds = featuredCollections.filter((cid: any) => !isNaN(Number(cid)));
    if (validIds.length > 0) {
      featuredCollectionDetails = await sql`
        SELECT c.id, c.title as name, c.description,
          i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
          (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count
        FROM collections c
        LEFT JOIN images i ON c.cover_image_id = i.id
        WHERE c.id IN (${sql.join(validIds)}) AND c.is_public = 1
      `.execute(db).then(r => r.rows as any[]);
      featuredCollectionDetails.sort((a: any, b: any) =>
        featuredCollections.indexOf(a.id) - featuredCollections.indexOf(b.id)
      );
    }
  }

  // 获取用户等级信息
  let levelData = null;
  try {
    const levelInfo = await getUserLevel(userId);
    levelData = {
      level: levelInfo.level,
      title: levelInfo.title,
      exp: levelInfo.exp,
      nextExp: levelInfo.nextExp,
      prevExp: levelInfo.prevExp,
      expProgress: levelInfo.expProgress,
    };
  } catch { levelData = null; }

  // 获取会员信息
  let membershipInfo = null;
  try {
    const m = await db
      .selectFrom("memberships")
      .select(["plan", "started_at", "expires_at", "status"])
      .where("user_id", "=", userId)
      .where("status", "=", "active")
      .limit(1)
      .executeTakeFirst();
    if (m) {
      membershipInfo = {
        plan: m.plan || "free",
        startedAt: m.started_at instanceof Date ? m.started_at.toISOString() : m.started_at,
        expiresAt: m.expires_at instanceof Date ? m.expires_at.toISOString() : m.expires_at,
        status: m.status || "active",
      };
    }
    // 管理员也显示会员标识
    if (user.role === "admin") {
      membershipInfo = { plan: "admin", startedAt: null, expiresAt: null, status: "active" };
    }
  } catch { membershipInfo = null; }

  // 已通过的壁纸（分页）
  const images = await db
    .selectFrom("images")
    .select(["id", "title", "url", "thumbnail_url", "view_count", "download_count"])
    .where("uploaded_by", "=", userId)
    .where("status", "=", "approved")
    .orderBy("created_at", "desc")
    .limit(24)
    .execute();

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: user.name,
    image: user.avatar || undefined,
    description: user.bio || undefined,
    url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/user/${user.id}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UserClient
        user={{
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          banner: user.banner,
          bio: user.bio,
          socialLinks,
          isVerified: user.is_verified || 0,
          role: user.role,
          createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at),
        }}
        stats={{
          totalImages: Number(stats?.totalImages || 0),
          totalViews: Number(stats?.totalViews || 0),
          totalDownloads: Number(stats?.totalDownloads || 0),
          totalFavorites: Number(stats?.totalFavorites || 0),
        }}
        followers={Number(followStats?.followers || 0)}
        following={Number(followStats?.following || 0)}
        featuredCollections={featuredCollectionDetails}
        images={images}
        levelData={levelData}
        membershipInfo={membershipInfo}
      />
    </>
  );
}