import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import CreatorClient from "./CreatorClient";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creatorId = Number(id);

  // 获取用户信息
  const user = await db
    .selectFrom("users")
    .select(["id", "name", "avatar", "role", "created_at"])
    .where("id", "=", creatorId)
    .executeTakeFirst();

  if (!user) {
    notFound();
  }

  // 获取已通过的壁纸
  const images = await db
    .selectFrom("images")
    .selectAll()
    .where("uploaded_by", "=", creatorId)
    .where("status", "=", "approved")
    .orderBy("created_at", "desc")
    .execute();

  // 统计数据
  const stats = await db
    .selectFrom("images")
    .select((eb) => [
      eb.fn.countAll().as("totalImages"),
      eb.fn.coalesce(eb.fn.sum("view_count"), eb.val(0)).as("totalViews"),
      eb.fn.coalesce(eb.fn.sum("download_count"), eb.val(0)).as("totalDownloads"),
    ])
    .where("uploaded_by", "=", creatorId)
    .where("status", "=", "approved")
    .executeTakeFirst();

  return (
    <CreatorClient
      user={{
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at),
      }}
      images={images}
      stats={{
        totalImages: Number(stats?.totalImages || 0),
        totalViews: Number(stats?.totalViews || 0),
        totalDownloads: Number(stats?.totalDownloads || 0),
      }}
    />
  );
}