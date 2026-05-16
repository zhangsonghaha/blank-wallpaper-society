import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/challenges - 获取活动列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    let sql = `SELECT c.*, u.name as creator_name,
                      (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.challenge_id = c.id) as submission_count,
                      (SELECT COUNT(*) FROM challenge_votes cv WHERE cv.challenge_id = c.id) as vote_count
               FROM challenges c
               LEFT JOIN users u ON c.created_by = u.id`;
    const params: any[] = [];

    if (status !== "all") {
      sql += ` WHERE c.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(String(limit), String(offset));

    // 自动流转状态：draft → active → ended
    const now = new Date();
    await query(
      `UPDATE challenges SET status = 'active' WHERE status = 'draft' AND start_time <= ? AND end_time > ?`,
      [now, now]
    );
    await query(
      `UPDATE challenges SET status = 'ended' WHERE status = 'active' AND end_time <= ?`,
      [now]
    );

    const rows = await query(sql, params);

    // 获取总数
    let countSql = `SELECT COUNT(*) as total FROM challenges`;
    const countParams: any[] = [];
    if (status !== "all") {
      countSql += ` WHERE status = ?`;
      countParams.push(status);
    }
    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("GET /api/challenges error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/challenges - 创建活动（管理员）
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const {
      title, description, bannerUrl, category,
      startTime, endTime, maxSubmissions, votesPerDay,
      prizeExp, prizeDescription,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "活动标题不能为空" }, { status: 400 });
    }

    if (!startTime || !endTime) {
      return NextResponse.json({ error: "请设置活动时间" }, { status: 400 });
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return NextResponse.json({ error: "结束时间必须晚于开始时间" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO challenges (title, description, banner_url, category, start_time, end_time,
        max_submissions, votes_per_day, prize_exp, prize_description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        description || null,
        bannerUrl || null,
        category || null,
        startTime,
        endTime,
        maxSubmissions || 3,
        votesPerDay || 5,
        prizeExp || 100,
        prizeDescription || null,
        userId,
      ]
    );

    return NextResponse.json(
      { data: { id: (result as any).insertId }, message: "活动创建成功" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/challenges error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}