import { NextResponse } from "next/server";
import { getClientAnalyticsConfig } from "@/lib/analytics";

// GET /api/analytics-config - 获取客户端分析配置（公开，无鉴权）
export async function GET() {
  try {
    const config = await getClientAnalyticsConfig();
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ provider: "none" });
  }
}