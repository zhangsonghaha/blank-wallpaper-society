import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

    await db
      .updateTable("membership_redeem_codes")
      .set({ status })
      .where("id", "=", codeId)
      .execute();

    // 验证更新是否成功
    const updated = await db
      .selectFrom("membership_redeem_codes")
      .select("id")
      .where("id", "=", codeId)
      .where("status", "=", status)
      .executeTakeFirst();

    if (!updated) {
      return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
    }

    // 记录操作日志
    const operatorId = (session.user as any).id;
    await db.insertInto("admin_operation_logs").values({
      operator_id: operatorId,
      operation: "update_redeem_code",
      detail: JSON.stringify({ codeId, status }),
    }).execute();

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
    const codes = await db
      .selectFrom("membership_redeem_codes")
      .selectAll()
      .where("id", "=", codeId)
      .execute();

    if (codes.length === 0) {
      return NextResponse.json({ error: "兑换码不存在" }, { status: 404 });
    }

    if (codes[0].used_count > 0) {
      return NextResponse.json({ error: "已使用的兑换码不能删除，请禁用" }, { status: 400 });
    }

    await db.deleteFrom("membership_redeem_codes").where("id", "=", codeId).execute();

    // 记录操作日志
    const operatorId = (session.user as any).id;
    await db.insertInto("admin_operation_logs").values({
      operator_id: operatorId,
      operation: "delete_redeem_code",
      detail: JSON.stringify({ codeId, code: codes[0].code }),
    }).execute();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/membership/redeem-codes/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
