import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
    const challengeRows = await query(
      `SELECT c.*, u.name as creator_name,
              (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id) as submission_count,
              (SELECT COUNT(*) FROM challenge_votes cv WHERE cv.challenge_id = c.id) as vote_count
       FROM challenges c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [challengeId]
    ) as any[];

    if (challengeRows.length === 0) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }

    const challenge = challengeRows[0];

    if (action === "leaderboard") {
      // 排行榜：按投票数排序
      const leaderboard = await query(
        `SELECT cs.id as submission_id, cs.image_id, cs.user_id, u.name as user_name, u.avatar as user_avatar,
                i.title, i.url, i.thumbnail_url, i.width, i.height,
                COUNT(cv.id) as vote_count
         FROM challenge_submissions cs
         LEFT JOIN challenge_votes cv ON cs.id = cv.submission_id
         LEFT JOIN users u ON cs.user_id = u.id
         LEFT JOIN images i ON cs.image_id = i.id
         WHERE cs.challenge_id = ? AND cs.status IN ('approved', 'pending')
         GROUP BY cs.id
         ORDER BY vote_count DESC, cs.created_at ASC
         LIMIT 50`,
        [challengeId]
      );

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

    const submissions = await query(
      `SELECT cs.id, cs.user_id, cs.image_id, cs.created_at, cs.status as sub_status,
              u.name as user_name, u.avatar as user_avatar,
              i.title, i.url, i.thumbnail_url, i.width, i.height,
              (SELECT COUNT(*) FROM challenge_votes cv WHERE cv.submission_id = cs.id) as vote_count
       FROM challenge_submissions cs
       LEFT JOIN users u ON cs.user_id = u.id
       LEFT JOIN images i ON cs.image_id = i.id
       WHERE cs.challenge_id = ? AND cs.status IN ('approved', 'pending')
       ORDER BY cs.created_at DESC
       LIMIT ? OFFSET ?`,
      [challengeId, limit, offset]
    );

    // 检查当前用户是否已投稿
    const session = await auth();
    let userSubmissionCount = 0;
    let userVotesToday = 0;
    if (session?.user) {
      const userId = (session.user as any).id;
      const mySubs = await query(
        "SELECT COUNT(*) as count FROM challenge_submissions WHERE challenge_id = ? AND user_id = ?",
        [challengeId, userId]
      ) as any[];
      userSubmissionCount = mySubs[0]?.count || 0;

      const myVotes = await query(
        "SELECT COUNT(*) as count FROM challenge_votes WHERE challenge_id = ? AND user_id = ? AND DATE(created_at) = CURDATE()",
        [challengeId, userId]
      ) as any[];
      userVotesToday = myVotes[0]?.count || 0;
    }

    const maxSubmissions = parseInt(challenge.max_submissions) || 3;
    const votesPerDay = parseInt(challenge.votes_per_day) || 5;

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
    const existing = await query("SELECT id FROM challenges WHERE id = ?", [challengeId]) as any[];
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
    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { updates.push("title = ?"); values.push(title.trim()); }
    if (description !== undefined) { updates.push("description = ?"); values.push(description || null); }
    if (category !== undefined) { updates.push("category = ?"); values.push(category || null); }
    if (startTime !== undefined) { updates.push("start_time = ?"); values.push(startTime); }
    if (endTime !== undefined) { updates.push("end_time = ?"); values.push(endTime); }
    if (maxSubmissions !== undefined) { updates.push("max_submissions = ?"); values.push(maxSubmissions); }
    if (votesPerDay !== undefined) { updates.push("votes_per_day = ?"); values.push(votesPerDay); }
    if (prizeExp !== undefined) { updates.push("prize_exp = ?"); values.push(prizeExp); }
    if (prizeDescription !== undefined) { updates.push("prize_description = ?"); values.push(prizeDescription || null); }
    if (status !== undefined) {
      const validStatuses = ["draft", "active", "ended", "settled"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "无效的状态值" }, { status: 400 });
      }
      updates.push("status = ?");
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    values.push(challengeId);
    await query(`UPDATE challenges SET ${updates.join(", ")} WHERE id = ?`, values);

    return NextResponse.json({ message: "活动更新成功" });
  } catch (error: any) {
    console.error("PUT /api/challenges/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}