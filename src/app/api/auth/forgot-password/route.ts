import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

// POST /api/auth/forgot-password - 请求密码重置
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });
    }

    // 查找用户
    const users = (await query("SELECT id, name, email FROM users WHERE email = ?", [
      email,
    ])) as any[];

    if (users.length === 0) {
      // 安全考虑：不透露邮箱是否存在
      return NextResponse.json({
        message: "如果该邮箱已注册，重置链接已发送",
      });
    }

    const user = users[0];

    // 生成重置令牌
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

    // 删除该用户之前的未使用令牌
    await query(
      "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
      [user.id]
    );

    // 插入新令牌
    await query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, token, expiresAt]
    );

    // 构建重置链接
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // TODO: 在这里发送邮件
    // 目前由于没有邮件服务，直接返回 token 用于开发测试
    // 生产环境应该发送邮件并移除 token 返回
    console.log(`[DEV] 密码重置链接: ${resetUrl}`);

    return NextResponse.json({
      message: "如果该邮箱已注册，重置链接已发送",
      // 开发环境返回 token，生产环境应移除
      ...(process.env.NODE_ENV === "development" && { dev_token: token }),
    });
  } catch (error: any) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json(
      { error: error.message || "请求失败" },
      { status: 500 }
    );
  }
}