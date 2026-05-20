import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyForVerification } from "@/lib/creator-verification";
import { validateRequestBody, creatorApplicationSchema } from "@/lib/api-schemas";

// POST /api/creator/apply - 提交认证申请
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const body = await request.json();
    const validation = validateRequestBody(creatorApplicationSchema, body);
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await applyForVerification(userId, validation.data);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error("POST /api/creator/apply error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}