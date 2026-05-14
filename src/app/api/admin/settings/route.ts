import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/settings - 获取所有系统设置
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const rows = await query("SELECT * FROM system_settings ORDER BY id ASC");
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/settings - 批量更新设置
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || Object.keys(settings).length === 0) {
      return NextResponse.json({ error: "没有更新内容" }, { status: 400 });
    }

    // 批量更新
    const updates = Object.entries(settings).map(([key, value]) =>
      query(
        "UPDATE system_settings SET setting_value = ? WHERE setting_key = ?",
        [value, key]
      )
    );

    await Promise.all(updates);

    return NextResponse.json({ message: "设置已保存" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}