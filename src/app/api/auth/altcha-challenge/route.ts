import { NextResponse } from "next/server";
import { createAltchaChallenge } from "@/lib/altcha";

// GET /api/auth/altcha-challenge - 获取 Altcha v3 验证码挑战
export async function GET() {
  try {
    const challenge = await createAltchaChallenge();
    return NextResponse.json(challenge);
  } catch (error: any) {
    console.error("GET /api/auth/altcha-challenge error:", error);
    return NextResponse.json({ error: "生成验证码失败" }, { status: 500 });
  }
}