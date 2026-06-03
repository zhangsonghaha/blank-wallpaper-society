import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const keyId = parseInt(id);

    // 确认Key属于当前用户
    const rows = await db
      .selectFrom("api_keys")
      .select("id")
      .where("id", "=", keyId)
      .where("user_id", "=", userId)
      .execute();

    if (rows.length === 0) {
      return NextResponse.json({ error: "API Key不存在" }, { status: 404 });
    }

    // 删除关联的使用日志
    await db.deleteFrom("api_usage_logs").where("api_key_id", "=", keyId).executeTakeFirst();

    // 删除Key
    await db.deleteFrom("api_keys").where("id", "=", keyId).where("user_id", "=", userId).executeTakeFirst();

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
    const keyId = parseInt(id);
    const body = await request.json();
    const { name, rate_limit, is_active, expires_in_days } = body;

    // 确认Key属于当前用户
    const rows = await db
      .selectFrom("api_keys")
      .select("id")
      .where("id", "=", keyId)
      .where("user_id", "=", userId)
      .execute();

    if (rows.length === 0) {
      return NextResponse.json({ error: "API Key不存在" }, { status: 404 });
    }

    const updateObj: Record<string, any> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Key名称不能为空" }, { status: 400 });
      }
      updateObj.name = name.trim();
    }
    if (rate_limit !== undefined) {
      if (rate_limit < 1 || rate_limit > 100000) {
        return NextResponse.json(
          { error: "限流值需在1-100000之间" },
          { status: 400 }
        );
      }
      updateObj.rate_limit = rate_limit;
    }
    if (is_active !== undefined) {
      updateObj.is_active = is_active ? 1 : 0;
    }
    if (expires_in_days !== undefined) {
      // expires_in_days: 0=永不过期, >0=从现在起N天后
      updateObj.expires_at = expires_in_days > 0
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")
        : null;
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    await db
      .updateTable("api_keys")
      .set(updateObj)
      .where("id", "=", keyId)
      .executeTakeFirst();

    // 返回更新后的数据
    const updated = await db
      .selectFrom("api_keys")
      .select(["id", "key_prefix", "name", "rate_limit", "is_active", "created_at", "last_used_at", "expires_at"])
      .where("id", "=", keyId)
      .execute();

    return NextResponse.json({ data: updated[0] });
  } catch (error: any) {
    console.error("PATCH /api/api-keys/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
