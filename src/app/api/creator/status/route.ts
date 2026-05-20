import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVerificationStatus } from "@/lib/creator-verification";

// GET /api/creator/status - 获取认证状态
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const status = await getVerificationStatus(userId);
    if (!status) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: status });
  } catch (error: any) {
    console.error("GET /api/creator/status error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}