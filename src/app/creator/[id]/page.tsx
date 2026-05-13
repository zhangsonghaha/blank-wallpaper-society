import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import CreatorClient from "./CreatorClient";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 获取用户信息
  const users = (await query(
    "SELECT id, name, avatar, role, created_at FROM users WHERE id = ?",
    [id]
  )) as any[];

  if (users.length === 0) {
    notFound();
  }

  const user = users[0];

  // 获取已通过的壁纸
  const images = (await query(
    "SELECT * FROM images WHERE uploaded_by = ? AND status = 'approved' ORDER BY created_at DESC",
    [id]
  )) as any[];

  // 统计数据
  const [stats] = (await query(
    "SELECT COUNT(*) as totalImages, COALESCE(SUM(view_count), 0) as totalViews, COALESCE(SUM(download_count), 0) as totalDownloads FROM images WHERE uploaded_by = ? AND status = 'approved'",
    [id]
  )) as any[];

  return (
    <CreatorClient
      user={{
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.created_at,
      }}
      images={images}
      stats={{
        totalImages: stats?.totalImages || 0,
        totalViews: stats?.totalViews || 0,
        totalDownloads: stats?.totalDownloads || 0,
      }}
    />
  );
}