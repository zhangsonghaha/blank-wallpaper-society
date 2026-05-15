import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/user/follow-stats - 获取当前用户的粉丝和关注数
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 获取粉丝数
    const followersResult = (await query(
      "SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?",
      [userId]
    )) as any[];
    const followersCount = followersResult[0]?.count || 0;

    // 获取关注数
    const followingResult = (await query(
      "SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?",
      [userId]
    )) as any[];
    const followingCount = followingResult[0]?.count || 0;

    return NextResponse.json({
      followers: followersCount,
      following: followingCount,
    });
  } catch (error: any) {
    console.error("GET /api/user/follow-stats error:", error);
    return NextResponse.json(
      { error: error.message || "获取关注统计失败" },
      { status: 500 }
    );
  }
}