import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeishuWsStatus } from "@/lib/feishu-ws-client";

// GET /api/admin/bots/feishu-ws-status - 获取飞书长连接状态
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const status = getFeishuWsStatus();
    return NextResponse.json({ clients: status });
  } catch (error: any) {
    console.error("[FeishuWsStatus] 获取状态异常:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}