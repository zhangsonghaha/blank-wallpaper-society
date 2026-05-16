import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/altcha";

// GET /api/auth/altcha-challenge - 获取 Altcha 验证码挑战
export async function GET() {
  try {
    const challenge = createChallenge();
    return NextResponse.json(challenge);
  } catch (error: any) {
    console.error("GET /api/auth/altcha-challenge error:", error);
    return NextResponse.json({ error: "生成验证码失败" }, { status: 500 });
  }
}