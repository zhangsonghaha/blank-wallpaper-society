import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import { testBotConnection } from "@/lib/bot-notification";

// POST /api/admin/bots/connectivity - 测试机器人连通性
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "缺少机器人ID" }, { status: 400 });
    }

    const result = await testBotConnection(Number(id));

    // 审计日志
    const adminId = (session.user as any).id;
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    logAudit({
      operatorId: adminId,
      operation: "bot_config_connectivity_test",
      detail: { id: Number(id), success: result.success, latency: result.latency },
      ip: clientIp?.split(",")[0]?.trim(),
    }).catch(() => {});

    if (result.success) {
      return NextResponse.json({ message: "连通性测试成功", latency: result.latency });
    } else {
      return NextResponse.json(
        { error: `连通性测试失败: ${result.error}`, latency: result.latency },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}