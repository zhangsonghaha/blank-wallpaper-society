import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sanitizeStrict } from "@/lib/sanitize";

// POST /api/feedback - 提交用户反馈
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, category, pageUrl, screenshotUrl } = body;

    if (!content?.trim() || content.trim().length < 5) {
      return NextResponse.json({ error: "请输入至少5个字的反馈内容" }, { status: 400 });
    }

    if (content.trim().length > 2000) {
      return NextResponse.json({ error: "反馈内容不能超过2000字" }, { status: 400 });
    }

    // 获取用户信息（可选，允许匿名反馈）
    let userId: number | null = null;
    try {
      const session = await auth();
      if (session?.user) {
        userId = (session.user as any).id;
      }
    } catch {}

    const safeContent = sanitizeStrict(content.trim());
    const safeCategory = ["bug", "feature", "improvement", "other"].includes(category) ? category : "other";
    const safePageUrl = pageUrl ? String(pageUrl).slice(0, 500) : null;
    const safeScreenshotUrl = screenshotUrl ? String(screenshotUrl).slice(0, 500) : null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;

    const result = await db
      .insertInto("feedback")
      .values({
        user_id: userId,
        content: safeContent,
        category: safeCategory,
        page_url: safePageUrl,
        screenshot_url: safeScreenshotUrl,
        user_agent: userAgent,
      })
      .executeTakeFirst();

    return NextResponse.json({
      success: true,
      id: Number(result.insertId),
      message: "感谢你的反馈！我们会尽快处理。",
    }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/feedback error:", error);
    return NextResponse.json({ error: "提交反馈失败" }, { status: 500 });
  }
}

// GET /api/feedback - 管理后台获取反馈列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 简单权限检查（管理员可在后台API中增强）
    const userRole = (session.user as any).role;
    if (!["admin", "moderator"].includes(userRole)) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query with dynamic conditions
    let query = db
      .selectFrom("feedback as f")
      .leftJoin("users as u", "u.id", "f.user_id")
      .selectAll("f")
      .select(["u.name as user_name", "u.email as user_email"]);

    if (status && ["pending", "in_progress", "resolved", "closed"].includes(status)) {
      query = query.where("f.status", "=", status as any);
    }
    if (category && ["bug", "feature", "improvement", "other"].includes(category)) {
      query = query.where("f.category", "=", category as any);
    }

    const [feedback, countResult] = await Promise.all([
      query
        .orderBy("f.created_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      // Build count query separately
      (async () => {
        let countQ = db.selectFrom("feedback as f").select((eb) => [eb.fn.count<number>("f.id").as("total")]);
        if (status && ["pending", "in_progress", "resolved", "closed"].includes(status)) {
          countQ = countQ.where("f.status", "=", status as any);
        }
        if (category && ["bug", "feature", "improvement", "other"].includes(category)) {
          countQ = countQ.where("f.category", "=", category as any);
        }
        return countQ.executeTakeFirst();
      })(),
    ]);

    const total = Number(countResult?.total ?? 0);

    return NextResponse.json({
      data: feedback,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
