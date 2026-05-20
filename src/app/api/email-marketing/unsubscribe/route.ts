import { NextRequest, NextResponse } from "next/server";
import { unsubscribeAll, unsubscribeByType } from "@/lib/email-marketing";

// POST /api/email-marketing/unsubscribe - 退订邮件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, type, all } = body;

    if (!token) {
      return NextResponse.json({ error: "缺少退订token" }, { status: 400 });
    }

    if (all) {
      // 全局退订
      const success = await unsubscribeAll(token);
      if (!success) {
        return NextResponse.json({ error: "无效的退订链接" }, { status: 400 });
      }
      return NextResponse.json({ message: "已退订所有邮件" });
    }

    // 按类型退订
    if (type && ["weekly_digest", "activity_notice", "creator_update"].includes(type)) {
      const success = await unsubscribeByType(token, type as any);
      if (!success) {
        return NextResponse.json({ error: "无效的退订链接" }, { status: 400 });
      }
      return NextResponse.json({ message: "已退订该类型邮件" });
    }

    return NextResponse.json({ error: "请指定退订类型" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/email-marketing/unsubscribe error:", error);
    return NextResponse.json({ error: error.message || "退订失败" }, { status: 500 });
  }
}