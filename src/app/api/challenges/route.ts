import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";

// GET /api/challenges - 获取活动列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // 自动流转状态：draft → active → ended
    const now = new Date();
    await db
      .updateTable("challenges")
      .set({ status: "active" })
      .where("status", "=", "draft")
      .where("start_time", "<=", now)
      .where("end_time", ">", now)
      .executeTakeFirst();
    await db
      .updateTable("challenges")
      .set({ status: "ended" })
      .where("status", "=", "active")
      .where("end_time", "<=", now)
      .executeTakeFirst();

    // Build challenge list query
    let query = db
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
      ]);

    if (status !== "all") {
      query = query.where("c.status", "=", status as "active" | "draft" | "ended" | "settled");
    }

    const rows = await query
      .orderBy("c.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 获取总数
    let countQuery = db
      .selectFrom("challenges")
      .select((eb) => [eb.fn.countAll().as("total")]);

    if (status !== "all") {
      countQuery = countQuery.where("status", "=", status as "active" | "draft" | "ended" | "settled");
    }

    const countResult = await countQuery.execute();
    const total = Number(countResult[0]?.total ?? 0);

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

    const result = await db
      .insertInto("challenges")
      .values({
        title: title.trim(),
        description: description || null,
        banner_url: bannerUrl || null,
        category: category || null,
        start_time: startTime,
        end_time: endTime,
        max_submissions: maxSubmissions || 3,
        votes_per_day: votesPerDay || 5,
        prize_exp: prizeExp || 100,
        prize_description: prizeDescription || null,
        created_by: userId,
      })
      .executeTakeFirst();

    return NextResponse.json(
      { data: { id: Number(result.insertId) }, message: "活动创建成功" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/challenges error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
