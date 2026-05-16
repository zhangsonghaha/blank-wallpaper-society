import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";
import { verifySolution, AltchaPayload } from "@/lib/altcha";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, altchaPayload } = await request.json();

    // 验证 Altcha 验证码
    if (!altchaPayload) {
      return NextResponse.json(
        { error: "请完成验证码" },
        { status: 400 }
      );
    }

    const altchaResult = verifySolution(altchaPayload as AltchaPayload);
    if (!altchaResult.valid) {
      return NextResponse.json(
        { error: altchaResult.error || "验证码验证失败" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码是必填项" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少 6 位" },
        { status: 400 }
      );
    }

    // 检查邮箱是否已注册
    const existing = (await query("SELECT id FROM users WHERE email = ?", [
      email,
    ])) as any[];

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 409 }
      );
    }

    // 创建用户（默认角色为 user）
    const hash = crypto.createHash("sha256").update(password).digest("hex");
    const result = await query(
      "INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, 'user')",
      [email, name || email.split("@")[0], hash]
    );

    // 发送欢迎邮件（非阻塞，失败不影响注册）
    const displayName = name || email.split("@")[0];
    sendWelcomeEmail(email, displayName).catch((err) => {
      console.error("[Register] 发送欢迎邮件失败:", err);
    });

    return NextResponse.json(
      {
        id: (result as any).insertId,
        message: "注册成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}