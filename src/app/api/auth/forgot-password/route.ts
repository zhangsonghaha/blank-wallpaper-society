import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";
import { verifyAltchaSolution } from "@/lib/altcha";
import { getClientIp, checkForgotPasswordRate, recordForgotPasswordAttempt } from "@/lib/login-security";
import { sendPasswordResetEmail } from "@/lib/email";

// POST /api/auth/forgot-password - 请求密码重置
export async function POST(request: NextRequest) {
  try {
    // IP 限流检查
    const ip = getClientIp(request);
    const rateCheck = checkForgotPasswordRate(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `请求过于频繁，请${rateCheck.remainingSeconds}秒后重试` },
        { status: 429 }
      );
    }

    const { email, altchaPayload } = await request.json();

    // 验证 Altcha 验证码
    if (!altchaPayload) {
      return NextResponse.json(
        { error: "请完成验证码" },
        { status: 400 }
      );
    }

    const altchaResult = await verifyAltchaSolution(altchaPayload);
    if (!altchaResult.valid) {
      return NextResponse.json(
        { error: altchaResult.error || "验证码验证失败" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });
    }

    // 记录请求（无论是否成功都记录，防止枚举探测）
    recordForgotPasswordAttempt(ip);

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

    // 发送密码重置邮件
    await sendPasswordResetEmail(user.email, resetUrl);

    return NextResponse.json({
      message: "如果该邮箱已注册，重置链接已发送",
    });
  } catch (error: any) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json(
      { error: error.message || "请求失败" },
      { status: 500 }
    );
  }
}