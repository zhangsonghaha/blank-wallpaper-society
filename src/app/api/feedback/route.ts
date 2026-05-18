import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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

    const result = await query(
      `INSERT INTO feedback (user_id, content, category, page_url, screenshot_url, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, safeContent, safeCategory, safePageUrl, safeScreenshotUrl, userAgent]
    );

    return NextResponse.json({
      success: true,
      id: (result as any).insertId,
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

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && ["pending", "in_progress", "resolved", "closed"].includes(status)) {
      conditions.push("f.status = ?");
      params.push(status);
    }
    if (category && ["bug", "feature", "improvement", "other"].includes(category)) {
      conditions.push("f.category = ?");
      params.push(category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [feedback, countResult] = await Promise.all([
      query(
        `SELECT f.*, u.name as user_name, u.email as user_email
         FROM feedback f
         LEFT JOIN users u ON f.user_id = u.id
         ${whereClause}
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*) as total FROM feedback f ${whereClause}`, params),
    ]);

    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({
      data: feedback,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("GET /api/feedback error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}