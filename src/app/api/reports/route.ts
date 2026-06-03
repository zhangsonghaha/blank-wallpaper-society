import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// POST /api/reports - 用户举报图片
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = await request.json();
    const { imageId, reason } = body;

    if (!imageId) {
      return NextResponse.json({ error: "缺少图片ID" }, { status: 400 });
    }

    if (!reason?.trim()) {
      return NextResponse.json({ error: "请填写举报原因" }, { status: 400 });
    }

    if (reason.trim().length > 500) {
      return NextResponse.json(
        { error: "举报原因不能超过500字" },
        { status: 400 }
      );
    }

    // 检查图片是否存在
    const imageExists = await db
      .selectFrom("images")
      .select("id")
      .where("id", "=", imageId)
      .execute();
    if (imageExists.length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const reporterId = (session.user as any).id;

    // 检查是否已举报过（同一用户对同一图片）
    const existingReport = await db
      .selectFrom("reports")
      .select("id")
      .where("image_id", "=", imageId)
      .where("reporter_id", "=", reporterId)
      .where("status", "=", "pending")
      .execute();
    if (existingReport.length > 0) {
      return NextResponse.json({ error: "您已举报过该图片，请等待处理" }, { status: 400 });
    }

    await db
      .insertInto("reports")
      .values({
        image_id: imageId,
        reporter_id: reporterId,
        reason: reason.trim(),
        status: "pending",
      })
      .executeTakeFirst();

    return NextResponse.json(
      { message: "举报成功，我们会尽快处理" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/reports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/reports - 管理员获取举报列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    const validStatuses = ["pending", "reviewed", "resolved"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "无效的状态参数，可选值: pending, reviewed, resolved" },
        { status: 400 }
      );
    }

    // 获取总数
    const countResult = await db
      .selectFrom("reports")
      .select((eb) => [eb.fn.count<number>("id").as("total")])
      .where("status", "=", status)
      .executeTakeFirst();
    const total = Number(countResult?.total ?? 0);

    // 获取举报列表，关联图片和用户信息
    const rows = await db
      .selectFrom("reports as r")
      .leftJoin("images as i", "i.id", "r.image_id")
      .leftJoin("users as reporter", "reporter.id", "r.reporter_id")
      .leftJoin("users as resolver", "resolver.id", "r.resolved_by")
      .selectAll("r")
      .select([
        "i.title as image_title",
        "i.url as image_url",
        "i.thumbnail_url as image_thumbnail",
        "reporter.name as reporter_name",
        "reporter.email as reporter_email",
        "resolver.name as resolver_name",
      ])
      .where("r.status", "=", status)
      .orderBy("r.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/reports - 管理员处理举报
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { reportId, action } = body;

    if (!reportId) {
      return NextResponse.json({ error: "缺少举报ID" }, { status: 400 });
    }

    if (!action || !["dismiss", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "无效的 action 参数，可选值: dismiss(驳回), remove(下架图片)" },
        { status: 400 }
      );
    }

    // 检查举报记录是否存在
    const existing = await db
      .selectFrom("reports")
      .select(["id", "image_id"])
      .where("id", "=", reportId)
      .execute();
    if (existing.length === 0) {
      return NextResponse.json({ error: "举报记录不存在" }, { status: 404 });
    }

    const report = existing[0];
    const adminId = (session.user as any).id;

    // 更新举报状态
    const newStatus = action === "dismiss" ? "reviewed" : "resolved";
    await db
      .updateTable("reports")
      .set({
        status: newStatus,
        resolved_by: adminId,
        resolved_at: sql`NOW()`,
      })
      .where("id", "=", reportId)
      .executeTakeFirst();

    // 如果是下架操作，同时将图片状态改为 rejected
    if (action === "remove") {
      await db
        .updateTable("images")
        .set({
          status: "rejected",
          reviewed_by: adminId,
          reviewed_at: sql`NOW()`,
          reject_reason: "因举报被下架",
        })
        .where("id", "=", report.image_id)
        .executeTakeFirst();
    }

    return NextResponse.json({
      message: action === "dismiss" ? "已驳回举报" : "已下架图片",
      reportId,
      status: newStatus,
    });
  } catch (error: any) {
    console.error("PATCH /api/reports error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
