import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { hashPassword } from "@/lib/password";

// POST /api/auth/reset-password - 通过令牌重置密码
export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "密码至少 6 个字符" }, { status: 400 });
    }

    // 查找有效的重置令牌
    const tokens = await db
      .selectFrom("password_reset_tokens")
      .selectAll()
      .where("token", "=", token)
      .where("used_at", "is", null)
      .where("expires_at", ">", sql<Date>`NOW()`)
      .execute();

    if (tokens.length === 0) {
      return NextResponse.json({ error: "重置链接无效或已过期" }, { status: 400 });
    }

    const resetToken = tokens[0];

    // 更新密码
    const newHash = await hashPassword(newPassword);
    await db
      .updateTable("users")
      .set({ password: newHash })
      .where("id", "=", resetToken.user_id)
      .execute();

    // 标记令牌已使用
    await db
      .updateTable("password_reset_tokens")
      .set({ used_at: sql<Date>`NOW()` })
      .where("id", "=", resetToken.id)
      .execute();

    return NextResponse.json({ message: "密码重置成功" });
  } catch (error: any) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json(
      { error: error.message || "重置失败" },
      { status: 500 }
    );
  }
}
