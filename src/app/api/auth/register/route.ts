import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyAltchaSolution } from "@/lib/altcha";
import { sendWelcomeEmail } from "@/lib/email";
import { sanitizeName, sanitizeEmail } from "@/lib/sanitize";
import { withTransaction } from "@/lib/db-tx";
import { hashPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, altchaPayload } = await request.json();

    // XSS 净化：过滤昵称和邮箱中的危险内容
    const cleanName = sanitizeName(name);
    const cleanEmail = sanitizeEmail(email);

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

    if (!cleanEmail || !password) {
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
      cleanEmail,
    ])) as any[];

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 409 }
      );
    }

    // 创建用户（默认角色为 user）- 使用事务保护
    const hashedPassword = await hashPassword(password);
    const result = await withTransaction(async (conn) => {
      // 在事务内再次检查邮箱，防止并发注册
      const [recheck] = await conn.execute(
        "SELECT id FROM users WHERE email = ? FOR UPDATE",
        [cleanEmail]
      );
      if ((recheck as any[]).length > 0) {
        throw new Error("CONFLICT:该邮箱已被注册");
      }

      const [insertResult] = await conn.execute(
        "INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, 'user')",
        [cleanEmail, cleanName || cleanEmail.split("@")[0], hashedPassword]
      );
      return insertResult;
    });

    // 发送欢迎邮件（非阻塞，失败不影响注册）
    const displayName = cleanName || cleanEmail.split("@")[0];
    sendWelcomeEmail(cleanEmail, displayName).catch((err) => {
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
    // 处理事务内抛出的并发冲突
    if (error.message?.startsWith("CONFLICT:")) {
      return NextResponse.json(
        { error: error.message.split("CONFLICT:")[1] },
        { status: 409 }
      );
    }
    console.error("POST /api/auth/register error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}