import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, safeExecute } from "@/lib/db";
import { sql } from "kysely";
import { indexImage, deleteImage, dbRowToSearchData } from "@/lib/meilisearch";
import { notifyReviewResult } from "@/lib/notification";
import { logAudit } from "@/lib/audit-log";

// GET /api/admin/review - 获取待审核图片列表（分页），支持按状态筛选
export async function GET(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;

    // 验证 status 参数
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "无效的状态参数，可选值: pending, approved, rejected" },
        { status: 400 }
      );
    }

    // 获取总数（独立容错）
    const countResult = await safeExecute(
      () => db.selectFrom("images")
        .where("status", "=", status)
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
      { total: 0 }
    );
    const total = Number(countResult?.total ?? 0);

    // 获取图片列表，关联审核人信息（独立容错）
    const rows = await safeExecute(
      () => sql<{
        id: number; title: string; url: string; thumbnail_url: string; status: string;
        created_at: string; reviewed_by: number; reviewed_at: string; reject_reason: string;
        uploaded_by: number; width: number; height: number; category: string; tags: string;
        reviewer_name: string;
      }>`SELECT i.*, u.name as reviewer_name
       FROM images i
       LEFT JOIN users u ON i.reviewed_by = u.id
       WHERE i.status = ${status}
       ORDER BY i.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`.execute(db),
      { rows: [] } as { rows: any[] },
      "review-list"
    );

    return NextResponse.json({
      data: Array.isArray(rows.rows) ? rows.rows : [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error("GET /api/admin/review error:", error);
    return NextResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 1,
    });
  }
}

// PATCH /api/admin/review - 审核操作（通过/拒绝）
export async function PATCH(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { imageId, action, rejectReason } = body;

    if (!imageId) {
      return NextResponse.json(
        { error: "缺少 imageId 参数" },
        { status: 400 }
      );
    }

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "无效的 action 参数，可选值: approve, reject" },
        { status: 400 }
      );
    }

    // 拒绝时必须填写原因
    if (action === "reject" && !rejectReason?.trim()) {
      return NextResponse.json(
        { error: "拒绝时必须填写原因" },
        { status: 400 }
      );
    }

    // 检查图片是否存在
    const existing = await db.selectFrom("images")
      .where("id", "=", imageId)
      .select(["id", "status", "title", "uploaded_by"])
      .execute();
    if (existing.length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const imageInfo = existing[0];

    const adminId = (session.user as any).id;
    const newStatus = action === "approve" ? "approved" : "rejected";

    await db.updateTable("images")
      .set({
        status: newStatus,
        reviewed_by: adminId,
        reviewed_at: sql`NOW()`,
        reject_reason: action === "reject" ? rejectReason.trim() : null,
      })
      .where("id", "=", imageId)
      .execute();

    // 自动同步 Meilisearch 索引
    try {
      if (action === "approve") {
        // 审核通过 -> 索引该图片
        const imageRows = await db.selectFrom("images")
          .where("id", "=", imageId)
          .selectAll()
          .execute();
        if (imageRows.length > 0) {
          indexImage(dbRowToSearchData(imageRows[0])).catch(() => {});
        }
      } else {
        // 审核拒绝 -> 从索引中删除
        deleteImage(imageId).catch(() => {});
      }
    } catch {
      // 索引操作失败不影响主流程
    }

    // 推送审核结果通知给上传者
    try {
      if (imageInfo.uploaded_by) {
        await notifyReviewResult(
          imageInfo.uploaded_by,
          imageInfo.title || `图片#${imageId}`,
          imageId,
          action === "approve",
          action === "reject" ? rejectReason?.trim() : undefined
        );
      }
    } catch {
      // 通知推送失败不影响主流程
    }

    // 记录审计日志
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    logAudit({
      operatorId: adminId,
      operation: action === "approve" ? "review_approve" : "review_reject",
      targetUserId: imageInfo.uploaded_by || undefined,
      detail: {
        imageId,
        imageTitle: imageInfo.title,
        rejectReason: action === "reject" ? rejectReason?.trim() : undefined,
      },
      ip: clientIp?.split(",")[0]?.trim(),
    }).catch(() => {});

    return NextResponse.json({
      message: action === "approve" ? "已通过审核" : "已拒绝",
      imageId,
      status: newStatus,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/review error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
