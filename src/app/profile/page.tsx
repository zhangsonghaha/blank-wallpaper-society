import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }

  const userId = (session.user as any).id;

  // 获取用户信息
  const users = (await query("SELECT id, email, name, avatar, role, created_at FROM users WHERE id = ?", [userId])) as any[];
  const user = users[0];

  if (!user) {
    redirect("/");
  }

  // 获取用户统计数据
  const [imageStats] = (await query(
    "SELECT COUNT(*) as total, COALESCE(SUM(view_count), 0) as totalViews FROM images WHERE author = ?",
    [user.name]
  )) as any[];

  const [favStats] = (await query(
    "SELECT COUNT(*) as total FROM favorites WHERE user_id = ?",
    [userId]
  )) as any[];

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.created_at,
      }}
      stats={{
        totalImages: imageStats?.total || 0,
        totalViews: imageStats?.totalViews || 0,
        totalFavorites: favStats?.total || 0,
      }}
    />
  );
}