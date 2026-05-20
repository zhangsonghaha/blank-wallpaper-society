import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reviewVerification } from "@/lib/creator-verification";
import { validateRequestBody, adminVerifySchema } from "@/lib/api-schemas";
import { logAudit } from "@/lib/audit-log";

// POST /api/admin/verify/[id] - 管理员审核认证
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }
    const reviewerId = (session.user as any).id;

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    const body = await request.json();
    const validation = validateRequestBody(adminVerifySchema, body);
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { action, reason } = validation.data;
    const result = await reviewVerification(userId, reviewerId, action, reason);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 记录审计日志
    await logAudit({
      operation: action === "approve" ? "review_approve" : "review_reject",
      operatorId: reviewerId,
      targetUserId: userId,
      detail: { type: "creator_verification", action, reason },
    });

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error("POST /api/admin/verify/[id] error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}