import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserAchievements } from "@/lib/user-level";

// GET /api/user/achievements - 获取所有成就定义 + 当前用户解锁状态
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const achievements = await getUserAchievements(userId);

    return NextResponse.json({ achievements });
  } catch (error: any) {
    console.error("GET /api/user/achievements error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}