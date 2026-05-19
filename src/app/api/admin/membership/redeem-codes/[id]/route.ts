import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { clearPattern } from "@/lib/redis";

// PATCH /api/admin/membership/redeem-codes/[id] - 修改兑换码状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const codeId = parseInt(id);
    if (isNaN(codeId)) {
      return NextResponse.json({ error: "无效的ID" }, { status: 400 });
    }

    const body = await request.json();
    const { status, note } = body;

    if (!["active", "disabled"].includes(status)) {
      return NextResponse.json({ error: "无效的状态" }, { status: 400 });
    }

    const result = await query(
      "UPDATE membership_redeem_codes SET status = ? WHERE id = ?",
      [status, codeId]
    ) as any;

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
    }

    // 记录操作日志
    const operatorId = (session.user as any).id;
    await query(
      "INSERT INTO admin_operation_logs (operator_id, operation, detail) VALUES (?, ?, ?)",
      [operatorId, "update_redeem_code", JSON.stringify({ codeId, status })]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/admin/membership/redeem-codes/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/membership/redeem-codes/[id] - 删除兑换码
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const codeId = parseInt(id);
    if (isNaN(codeId)) {
      return NextResponse.json({ error: "无效的ID" }, { status: 400 });
    }

    // 只能删除未使用的兑换码
    const codes = await query(
      "SELECT * FROM membership_redeem_codes WHERE id = ?",
      [codeId]
    ) as any[];

    if (codes.length === 0) {
      return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
    }

    if (codes[0].used_count > 0) {
      return NextResponse.json({ error: "已使用的兑换码不能删除，请禁用" }, { status: 400 });
    }

    await query("DELETE FROM membership_redeem_codes WHERE id = ?", [codeId]);

    // 记录操作日志
    const operatorId = (session.user as any).id;
    await query(
      "INSERT INTO admin_operation_logs (operator_id, operation, detail) VALUES (?, ?, ?)",
      [operatorId, "delete_redeem_code", JSON.stringify({ codeId, code: codes[0].code })]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/membership/redeem-codes/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}