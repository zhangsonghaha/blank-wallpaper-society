import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";

// GET /api/admin/crawl/schedule - 获取定时任务列表
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 从 system_settings 获取定时任务配置
    const schedules = await sql<Record<string, any>>`SELECT * FROM system_settings WHERE setting_key LIKE 'crawl_schedule_%'`.execute(db);

    return NextResponse.json({ data: schedules.rows });
  } catch (error: any) {
    console.error("GET /api/admin/crawl/schedule error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/crawl/schedule - 创建定时任务
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { name, cron, source, category, count, enabled } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "任务名称不能为空" }, { status: 400 });
    }

    if (!cron?.trim()) {
      return NextResponse.json({ error: "请设置cron表达式" }, { status: 400 });
    }

    const settingKey = `crawl_schedule_${Date.now()}`;
    const settingValue = JSON.stringify({
      name: name.trim(),
      cron: cron.trim(),
      source: source || "",
      category: category || "",
      count: count || 5,
      enabled: enabled !== false,
      createdAt: new Date().toISOString(),
    });

    await sql`INSERT INTO system_settings (setting_key, setting_value) VALUES (${settingKey}, ${settingValue}) ON DUPLICATE KEY UPDATE setting_value = ${settingValue}`.execute(db);

    return NextResponse.json(
      { data: { key: settingKey, value: settingValue }, message: "定时任务创建成功" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/admin/crawl/schedule error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/crawl/schedule - 删除定时任务
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "缺少任务key" }, { status: 400 });
    }

    await db.deleteFrom("system_settings").where("setting_key", "=", key).execute();

    return NextResponse.json({ message: "定时任务已删除" });
  } catch (error: any) {
    console.error("DELETE /api/admin/crawl/schedule error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/crawl/schedule - 更新定时任务（启用/禁用）
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { key, enabled } = body;

    if (!key) {
      return NextResponse.json({ error: "缺少任务key" }, { status: 400 });
    }

    // 读取当前配置
    const rows = await db.selectFrom("system_settings")
      .where("setting_key", "=", key)
      .select(["setting_value"])
      .execute();

    if (rows.length === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const config = JSON.parse(rows[0].setting_value!);
    if (enabled !== undefined) {
      config.enabled = enabled;
    }

    await db.updateTable("system_settings")
      .set({ setting_value: JSON.stringify(config) })
      .where("setting_key", "=", key)
      .execute();

    return NextResponse.json({ message: "定时任务更新成功" });
  } catch (error: any) {
    console.error("PATCH /api/admin/crawl/schedule error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
