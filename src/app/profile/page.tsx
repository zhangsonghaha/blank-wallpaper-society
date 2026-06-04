import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const ProfileClient = dynamic(() => import("./ProfileClient"), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-32 h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  const userId = (session.user as any).id;

  // 获取用户信息
  const user = await db
    .selectFrom("users")
    .select(["id", "email", "name", "avatar", "role", "is_verified", "created_at"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) {
    redirect("/");
  }

  // 获取用户统计数据
  const imageStats = await db
    .selectFrom("images")
    .select((eb) => [
      eb.fn.countAll().as("total"),
      eb.fn.coalesce(eb.fn.sum("view_count"), eb.val(0)).as("totalViews"),
    ])
    .where("author", "=", user.name)
    .executeTakeFirst();

  const favStats = await db
    .selectFrom("favorites")
    .select((eb) => eb.fn.countAll().as("total"))
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        is_verified: user.is_verified || 0,
        createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at),
      }}
      stats={{
        totalImages: Number(imageStats?.total || 0),
        totalViews: Number(imageStats?.totalViews || 0),
        totalFavorites: Number(favStats?.total || 0),
      }}
    />
  );
}