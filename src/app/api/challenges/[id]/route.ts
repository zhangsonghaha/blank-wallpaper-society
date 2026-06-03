import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";

// GET /api/challenges/[id] - 获取活动详情（含投稿列表和排行榜）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challengeId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (isNaN(challengeId)) {
      return NextResponse.json({ error: "无效的活动ID" }, { status: 400 });
    }

    // 获取活动详情
    const challengeRows = await db
      .selectFrom("challenges as c")
      .leftJoin("users as u", "u.id", "c.created_by")
      .select([
        "c.id", "c.title", "c.description", "c.banner_url", "c.category",
        "c.start_time", "c.end_time", "c.max_submissions", "c.votes_per_day",
        "c.prize_exp", "c.prize_description", "c.status", "c.created_by",
        "c.created_at", "c.updated_at",
        sql<string | null>`u.name`.as("creator_name"),
        sql<number>`(SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id)`.as("submission_count"),
        sql<number>`(SELECT COUNT(*) FROM challenge_votes cv WHERE cv.challenge_id = c.id)`.as("vote_count"),
      ])
      .where("c.id", "=", challengeId)
      .execute();

    if (challengeRows.length === 0) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }

    const challenge = challengeRows[0] as any;

    if (action === "leaderboard") {
      // 排行榜：按投票数排序
      const leaderboard = await db
        .selectFrom("challenge_submissions as cs")
        .leftJoin("challenge_votes as cv", "cv.submission_id", "cs.id")
        .leftJoin("users as u", "u.id", "cs.user_id")
        .leftJoin("images as i", "i.id", "cs.image_id")
        .select([
          sql<number>`cs.id`.as("submission_id"),
          "cs.image_id", "cs.user_id",
          sql<string>`u.name`.as("user_name"),
          sql<string | null>`u.avatar`.as("user_avatar"),
          sql<string>`i.title`.as("title"),
          sql<string>`i.url`.as("url"),
          sql<string | null>`i.thumbnail_url`.as("thumbnail_url"),
          sql<number | null>`i.width`.as("width"),
          sql<number | null>`i.height`.as("height"),
          sql<number>`COUNT(cv.id)`.as("vote_count"),
        ])
        .where("cs.challenge_id", "=", challengeId)
        .where("cs.status", "in", ["approved", "pending"])
        .groupBy("cs.id")
        .orderBy("vote_count", "desc")
        .orderBy("cs.created_at", "asc")
        .limit(50)
        .execute();

      return NextResponse.json({
        data: {
          challenge,
          leaderboard,
        },
      });
    }

    // 默认返回活动详情 + 最新投稿
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    const submissions = await db
      .selectFrom("challenge_submissions as cs")
      .leftJoin("users as u", "u.id", "cs.user_id")
      .leftJoin("images as i", "i.id", "cs.image_id")
      .select([
        "cs.id", "cs.user_id", "cs.image_id", "cs.created_at",
        sql<string | null>`cs.status`.as("sub_status"),
        sql<string>`u.name`.as("user_name"),
        sql<string | null>`u.avatar`.as("user_avatar"),
        sql<string>`i.title`.as("title"),
        sql<string>`i.url`.as("url"),
        sql<string | null>`i.thumbnail_url`.as("thumbnail_url"),
        sql<number | null>`i.width`.as("width"),
        sql<number | null>`i.height`.as("height"),
        sql<number>`(SELECT COUNT(*) FROM challenge_votes cv WHERE cv.submission_id = cs.id)`.as("vote_count"),
      ])
      .where("cs.challenge_id", "=", challengeId)
      .where("cs.status", "in", ["approved", "pending"])
      .orderBy("cs.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 检查当前用户是否已投稿
    const session = await auth();
    let userSubmissionCount = 0;
    let userVotesToday = 0;
    if (session?.user) {
      const userId = (session.user as any).id;
      const mySubs = await db
        .selectFrom("challenge_submissions")
        .select((eb) => [eb.fn.countAll().as("count")])
        .where("challenge_id", "=", challengeId)
        .where("user_id", "=", userId)
        .execute();
      userSubmissionCount = Number(mySubs[0]?.count ?? 0);

      const myVotes = await db
        .selectFrom("challenge_votes")
        .select((eb) => [eb.fn.countAll().as("count")])
        .where("challenge_id", "=", challengeId)
        .where("user_id", "=", userId)
        .where(sql`DATE(created_at)`, "=", sql`CURDATE()`)
        .execute();
      userVotesToday = Number(myVotes[0]?.count ?? 0);
    }

    const maxSubmissions = parseInt(String(challenge.max_submissions)) || 3;
    const votesPerDay = parseInt(String(challenge.votes_per_day)) || 5;

    return NextResponse.json({
      data: {
        challenge,
        submissions,
        userSubmissionCount,
        userVotesToday,
        canSubmit: userSubmissionCount < maxSubmissions,
        canVote: userVotesToday < votesPerDay,
        pagination: {
          page,
          limit,
          total: challenge.submission_count,
          totalPages: Math.ceil(challenge.submission_count / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/challenges/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/challenges/[id] - 编辑活动（管理员）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const challengeId = parseInt(id);
    if (isNaN(challengeId)) {
      return NextResponse.json({ error: "无效的活动ID" }, { status: 400 });
    }

    // 检查活动是否存在
    const existing = await db
      .selectFrom("challenges")
      .select(["id"])
      .where("id", "=", challengeId)
      .execute();
    if (existing.length === 0) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }

    const body = await request.json();
    const {
      title, description, category,
      startTime, endTime, maxSubmissions, votesPerDay,
      prizeExp, prizeDescription, status,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "活动标题不能为空" }, { status: 400 });
    }

    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
      return NextResponse.json({ error: "结束时间必须晚于开始时间" }, { status: 400 });
    }

    // 构建动态更新字段
    const updateData: Record<string, any> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description || null;
    if (category !== undefined) updateData.category = category || null;
    if (startTime !== undefined) updateData.start_time = startTime;
    if (endTime !== undefined) updateData.end_time = endTime;
    if (maxSubmissions !== undefined) updateData.max_submissions = maxSubmissions;
    if (votesPerDay !== undefined) updateData.votes_per_day = votesPerDay;
    if (prizeExp !== undefined) updateData.prize_exp = prizeExp;
    if (prizeDescription !== undefined) updateData.prize_description = prizeDescription || null;
    if (status !== undefined) {
      const validStatuses = ["draft", "active", "ended", "settled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "无效的状态值" }, { status: 400 });
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    await db
      .updateTable("challenges")
      .set(updateData)
      .where("id", "=", challengeId)
      .executeTakeFirst();

    return NextResponse.json({ message: "活动更新成功" });
  } catch (error: any) {
    console.error("PUT /api/challenges/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
