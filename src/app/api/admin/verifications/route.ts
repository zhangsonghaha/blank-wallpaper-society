import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPendingVerifications } from "@/lib/creator-verification";

// GET /api/admin/verifications - 管理员获取认证审核列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "pending";

    const result = await getPendingVerifications({ page, limit, status });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/admin/verifications error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}