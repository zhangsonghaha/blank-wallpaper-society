import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserLevel, getUserAchievements } from "@/lib/user-level";

// GET /api/user/level - 获取当前用户等级和成就概览
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const [levelInfo, achievements] = await Promise.all([
      getUserLevel(userId),
      getUserAchievements(userId),
    ]);

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    return NextResponse.json({
      level: levelInfo,
      achievements: {
        total: achievements.length,
        unlocked: unlockedCount,
        list: achievements,
      },
    });
  } catch (error: any) {
    console.error("GET /api/user/level error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}