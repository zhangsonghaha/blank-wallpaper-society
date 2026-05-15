import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// POST /api/users/[id]/follow - 关注/取关用户
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;
    const targetId = parseInt(id);

    if (isNaN(targetId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    if (Number(userId) === targetId) {
      return NextResponse.json({ error: "不能关注自己" }, { status: 400 });
    }

    // 检查目标用户是否存在
    const targetUsers = (await query("SELECT id FROM users WHERE id = ?", [
      targetId,
    ])) as any[];

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查是否已关注
    const existing = (await query(
      "SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?",
      [userId, targetId]
    )) as any[];

    if (existing.length > 0) {
      // 取关
      await query(
        "DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?",
        [userId, targetId]
      );
      return NextResponse.json({ following: false, message: "已取消关注" });
    } else {
      // 关注
      await query(
        "INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)",
        [userId, targetId]
      );
      return NextResponse.json({ following: true, message: "已关注" });
    }
  } catch (error: any) {
    console.error("POST /api/users/[id]/follow error:", error);
    return NextResponse.json(
      { error: error.message || "操作失败" },
      { status: 500 }
    );
  }
}

// GET /api/users/[id]/follow - 获取关注状态和数量
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const targetId = parseInt(id);

    if (isNaN(targetId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    // 获取粉丝数和关注数
    const followersCount = (await query(
      "SELECT COUNT(*) AS count FROM user_follows WHERE following_id = ?",
      [targetId]
    )) as any[];

    const followingCount = (await query(
      "SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = ?",
      [targetId]
    )) as any[];

    // 检查当前用户是否关注了该用户
    let isFollowing = false;
    const session = await auth();
    if (session?.user) {
      const userId = (session.user as any).id;
      const followStatus = (await query(
        "SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?",
        [userId, targetId]
      )) as any[];
      isFollowing = followStatus.length > 0;
    }

    return NextResponse.json({
      followersCount: followersCount[0]?.count || 0,
      followingCount: followingCount[0]?.count || 0,
      isFollowing,
    });
  } catch (error: any) {
    console.error("GET /api/users/[id]/follow error:", error);
    return NextResponse.json(
      { error: error.message || "获取失败" },
      { status: 500 }
    );
  }
}