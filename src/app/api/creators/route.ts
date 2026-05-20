import { NextRequest, NextResponse } from "next/server";
import { getVerifiedCreators } from "@/lib/creator-verification";

// GET /api/creators - 获取认证创作者列表（公开接口）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sort = searchParams.get("sort") || "verified_at";

    const result = await getVerifiedCreators({ page, limit, sort });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/creators error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}