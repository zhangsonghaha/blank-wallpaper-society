import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkStorageQuota } from "@/lib/storage-quota";

/**
 * GET /api/auth/quota - 获取当前用户存储配额信息
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const role = (session.user as any).role || "user";

    const quotaInfo = await checkStorageQuota(userId, role);

    return NextResponse.json(quotaInfo);
  } catch (error: any) {
    console.error("GET /api/auth/quota error:", error);
    return NextResponse.json({ error: error.message || "获取配额失败" }, { status: 500 });
  }
}