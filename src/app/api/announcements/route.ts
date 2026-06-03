import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET - 获取已发布的公告列表（用户端）
export async function GET() {
  try {
    const now = new Date();

    const list = await db
      .selectFrom("sys_announcements")
      .select(["id", "title", "content", "type", "priority", "start_time", "end_time", "created_at"])
      .where("is_published", "=", 1)
      .where((eb) => eb.or([
        eb("start_time", "is", null),
        eb("start_time", "<=", now),
      ]))
      .where((eb) => eb.or([
        eb("end_time", "is", null),
        eb("end_time", ">=", now),
      ]))
      .orderBy(sql`CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END`, "asc")
      .orderBy("created_at", "desc")
      .limit(10)
      .execute();

    return NextResponse.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error("获取公告列表失败:", error);
    return NextResponse.json({ success: false, error: "获取公告列表失败" }, { status: 500 });
  }
}
