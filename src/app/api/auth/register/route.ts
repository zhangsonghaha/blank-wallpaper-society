import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { verifyAltchaSolution } from "@/lib/altcha";
import { sendWelcomeEmail } from "@/lib/email";
import { sanitizeName, sanitizeEmail } from "@/lib/sanitize";
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
    const existing = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", cleanEmail)
      .execute();

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "该邮箱已被注册" },
        { status: 409 }
      );
    }

    // 创建用户（默认角色为 user）- 使用事务保护
    const hashedPassword = await hashPassword(password);
    const result = await db.transaction().execute(async (trx) => {
      // 在事务内部再次检查邮箱，防止并发注册
      const recheck = await trx
        .selectFrom("users")
        .select("id")
        .where("email", "=", cleanEmail)
        .forUpdate()
        .execute();
      if (recheck.length > 0) {
        throw new Error("CONFLICT:该邮箱已被注册");
      }

      const insertResult = await trx
        .insertInto("users")
        .values({
          email: cleanEmail,
          name: cleanName || cleanEmail.split("@")[0],
          password: hashedPassword,
          role: "user",
        })
        .executeTakeFirst();
      return insertResult;
    });

    // 发送欢迎邮件（非阻塞，失败不影响注册）
    const displayName = cleanName || cleanEmail.split("@")[0];
    sendWelcomeEmail(cleanEmail, displayName).catch((err) => {
      console.error("[Register] 发送欢迎邮件失败:", err);
    });

    return NextResponse.json(
      {
        id: Number(result.insertId),
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
