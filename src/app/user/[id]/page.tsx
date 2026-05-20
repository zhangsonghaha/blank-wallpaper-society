import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import { getUserLevel } from "@/lib/user-level";
import UserClient from "./UserClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  if (isNaN(userId)) return { title: "用户主页" };

  const users = (await query(
    "SELECT id, name, bio FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) return { title: "用户不存在" };

  const user = users[0];
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
  const users = (await query(
    `SELECT id, name, avatar, banner, bio, social_links, featured_collections,
      is_verified, role, created_at
    FROM users WHERE id = ?`,
    [userId]
  )) as any[];

  if (users.length === 0) notFound();

  const user = users[0];

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
  const [stats] = (await query(
    `SELECT
      COUNT(*) as totalImages,
      COALESCE(SUM(view_count), 0) as totalViews,
      COALESCE(SUM(download_count), 0) as totalDownloads,
      COALESCE(SUM(favorite_count), 0) as totalFavorites
    FROM images WHERE uploaded_by = ? AND status = 'approved'`,
    [userId]
  )) as any[];

  // 粉丝/关注数
  const [followStats] = (await query(
    `SELECT
      (SELECT COUNT(*) FROM user_follows WHERE following_id = ?) as followers,
      (SELECT COUNT(*) FROM user_follows WHERE follower_id = ?) as following`,
    [userId, userId]
  )) as any[];

  // 精选合集详情
  let featuredCollectionDetails: any[] = [];
  if (featuredCollections.length > 0) {
    const validIds = featuredCollections.filter((cid: any) => !isNaN(Number(cid)));
    if (validIds.length > 0) {
      featuredCollectionDetails = (await query(
        `SELECT c.id, c.name, c.description,
          i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
          (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count
        FROM collections c
        LEFT JOIN images i ON c.cover_image_id = i.id
        WHERE c.id IN (${validIds.map(() => "?").join(",")}) AND c.is_public = TRUE`,
        validIds
      )) as any[];
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
    const memberRows = (await query(
      "SELECT plan, started_at, expires_at, status FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1",
      [userId]
    )) as any[];
    if (memberRows.length > 0) {
      const m = memberRows[0];
      membershipInfo = {
        plan: m.plan,
        startedAt: m.started_at,
        expiresAt: m.expires_at,
        status: m.status,
      };
    }
    // 管理员也显示会员标识
    if (user.role === "admin") {
      membershipInfo = { plan: "admin", startedAt: null, expiresAt: null, status: "active" };
    }
  } catch { membershipInfo = null; }

  // 已通过的壁纸（分页）
  const images = (await query(
    "SELECT id, title, url, thumbnail_url, view_count, download_count FROM images WHERE uploaded_by = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 24",
    [userId]
  )) as any[];

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
          isVerified: user.is_verified,
          role: user.role,
          createdAt: user.created_at,
        }}
        stats={{
          totalImages: stats?.totalImages || 0,
          totalViews: stats?.totalViews || 0,
          totalDownloads: stats?.totalDownloads || 0,
          totalFavorites: stats?.totalFavorites || 0,
        }}
        followers={followStats?.followers || 0}
        following={followStats?.following || 0}
        featuredCollections={featuredCollectionDetails}
        images={images}
        levelData={levelData}
        membershipInfo={membershipInfo}
      />
    </>
  );
}