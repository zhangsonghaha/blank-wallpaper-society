import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

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