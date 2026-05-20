import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateBrandProfile } from "@/lib/creator-verification";
import { validateRequestBody, brandProfileSchema } from "@/lib/api-schemas";

// PATCH /api/creator/brand - 更新品牌资料（仅认证创作者可用）
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const body = await request.json();
    const validation = validateRequestBody(brandProfileSchema, body);
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await updateBrandProfile(userId, validation.data);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error("PATCH /api/creator/brand error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}