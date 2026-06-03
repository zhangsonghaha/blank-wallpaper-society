import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addExp, checkAchievements } from "@/lib/user-level";
import { notifyNewFollower } from "@/lib/notification";

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
    const targetUsers = await db
      .selectFrom("users")
      .select("id")
      .where("id", "=", targetId)
      .execute();

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查是否已关注
    const existing = await db
      .selectFrom("user_follows")
      .select("id")
      .where("follower_id", "=", Number(userId))
      .where("following_id", "=", targetId)
      .execute();

    if (existing.length > 0) {
      // 取关
      await db
        .deleteFrom("user_follows")
        .where("follower_id", "=", Number(userId))
        .where("following_id", "=", targetId)
        .executeTakeFirst();
      return NextResponse.json({ following: false, message: "已取消关注" });
    } else {
      // 关注
      await db
        .insertInto("user_follows")
        .values({ follower_id: Number(userId), following_id: targetId })
        .executeTakeFirst();
      // 关注成功 → 被关注者 +5 exp + 检查成就（异步不阻塞）
      addExp(targetId, 5).catch(() => {});
      checkAchievements(targetId).catch(() => {});
      // 通知被关注者
      const followerName = (session.user as any).name || "用户";
      notifyNewFollower(targetId, followerName, Number(userId)).catch(() => {});

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
    const followersCount = await db
      .selectFrom("user_follows")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("following_id", "=", targetId)
      .execute();

    const followingCount = await db
      .selectFrom("user_follows")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("follower_id", "=", targetId)
      .execute();

    // 检查当前用户是否关注了该用户
    let isFollowing = false;
    const session = await auth();
    if (session?.user) {
      const userId = (session.user as any).id;
      const followStatus = await db
        .selectFrom("user_follows")
        .select("id")
        .where("follower_id", "=", Number(userId))
        .where("following_id", "=", targetId)
        .execute();
      isFollowing = followStatus.length > 0;
    }

    return NextResponse.json({
      followersCount: Number(followersCount[0]?.count) || 0,
      followingCount: Number(followingCount[0]?.count) || 0,
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
