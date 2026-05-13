import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

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

    // 获取总数
    const countResult = await query(
      "SELECT COUNT(*) as total FROM images WHERE status = ?",
      [status]
    );
    const total = (countResult as any[])[0]?.total || 0;

    // 获取图片列表，关联审核人信息
    const rows = await query(
      `SELECT i.*, u.name as reviewer_name
       FROM images i
       LEFT JOIN users u ON i.reviewed_by = u.id
       WHERE i.status = ?
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [status, String(limit), String(offset)]
    );

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/admin/review error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    const existing = await query("SELECT id, status FROM images WHERE id = ?", [
      imageId,
    ]);
    if ((existing as any[]).length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const adminId = (session.user as any).id;
    const newStatus = action === "approve" ? "approved" : "rejected";

    await query(
      `UPDATE images SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reject_reason = ? WHERE id = ?`,
      [
        newStatus,
        adminId,
        action === "reject" ? rejectReason.trim() : null,
        imageId,
      ]
    );

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