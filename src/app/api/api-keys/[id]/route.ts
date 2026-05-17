import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// DELETE /api/api-keys/[id] - 删除API Key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;

    // 确认Key属于当前用户
    const rows = (await query(
      "SELECT id FROM api_keys WHERE id = ? AND user_id = ?",
      [id, userId]
    )) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "API Key不存在" }, { status: 404 });
    }

    // 删除关联的使用日志
    await query("DELETE FROM api_usage_logs WHERE api_key_id = ?", [id]);

    // 删除Key
    await query("DELETE FROM api_keys WHERE id = ? AND user_id = ?", [id, userId]);

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    console.error("DELETE /api/api-keys/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/api-keys/[id] - 更新API Key（名称、限流、启用/禁用）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;
    const body = await request.json();
    const { name, rate_limit, is_active, expires_in_days } = body;

    // 确认Key属于当前用户
    const rows = (await query(
      "SELECT id FROM api_keys WHERE id = ? AND user_id = ?",
      [id, userId]
    )) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "API Key不存在" }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Key名称不能为空" }, { status: 400 });
      }
      updates.push("name = ?");
      values.push(name.trim());
    }
    if (rate_limit !== undefined) {
      if (rate_limit < 1 || rate_limit > 100000) {
        return NextResponse.json(
          { error: "限流值需在1-100000之间" },
          { status: 400 }
        );
      }
      updates.push("rate_limit = ?");
      values.push(rate_limit);
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(is_active ? 1 : 0);
    }
    if (expires_in_days !== undefined) {
      // expires_in_days: 0=永不过期, >0=从现在起N天后
      const expiresAt = expires_in_days > 0
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")
        : null;
      updates.push("expires_at = ?");
      values.push(expiresAt);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    values.push(id);
    await query(
      `UPDATE api_keys SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    // 返回更新后的数据
    const updated = (await query(
      "SELECT id, key_prefix, name, rate_limit, is_active, created_at, last_used_at, expires_at FROM api_keys WHERE id = ?",
      [id]
    )) as any[];

    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    console.error("PATCH /api/api-keys/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}