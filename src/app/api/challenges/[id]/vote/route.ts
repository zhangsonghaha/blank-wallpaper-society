import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/challenges/[id]/vote - 投票
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    const challengeId = parseInt(id);

    if (isNaN(challengeId)) {
      return NextResponse.json({ error: "无效的活动ID" }, { status: 400 });
    }

    const body = await request.json();
    const { submissionId } = body;

    if (!submissionId) {
      return NextResponse.json({ error: "请选择要投票的投稿" }, { status: 400 });
    }

    // 验证活动存在且正在进行
    const challenge = (await query(
      "SELECT * FROM challenges WHERE id = ? AND status = 'active'",
      [challengeId]
    )) as any[];

    if (challenge.length === 0) {
      return NextResponse.json({ error: "活动不存在或未开始" }, { status: 404 });
    }

    // 验证投稿存在且属于该活动
    const submission = (await query(
      "SELECT id, user_id FROM challenge_submissions WHERE id = ? AND challenge_id = ? AND status = 'approved'",
      [submissionId, challengeId]
    )) as any[];

    if (submission.length === 0) {
      return NextResponse.json({ error: "投稿不存在" }, { status: 404 });
    }

    // 不能给自己的投稿投票
    if (submission[0].user_id === userId) {
      return NextResponse.json({ error: "不能给自己的投稿投票" }, { status: 400 });
    }

    // 检查今日投票数限制
    const todayVotes = (await query(
      "SELECT COUNT(*) as count FROM challenge_votes WHERE challenge_id = ? AND user_id = ? AND DATE(created_at) = CURDATE()",
      [challengeId, userId]
    )) as any[];

    if (todayVotes[0]?.count >= (challenge[0].votes_per_day || 5)) {
      return NextResponse.json({ error: `每天最多投${challenge[0].votes_per_day || 5}票` }, { status: 400 });
    }

    // 检查是否已投票
    const existingVote = (await query(
      "SELECT id FROM challenge_votes WHERE challenge_id = ? AND submission_id = ? AND user_id = ?",
      [challengeId, submissionId, userId]
    )) as any[];

    if (existingVote.length > 0) {
      return NextResponse.json({ error: "已投过票" }, { status: 409 });
    }

    await query(
      "INSERT INTO challenge_votes (challenge_id, submission_id, user_id) VALUES (?, ?, ?)",
      [challengeId, submissionId, userId]
    );

    return NextResponse.json({ message: "投票成功" }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/challenges/[id]/vote error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}