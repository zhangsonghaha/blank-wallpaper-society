import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET - 获取已发布的公告列表（用户端）
export async function GET() {
  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    const list = await query(
      `SELECT id, title, content, type, priority, start_time, end_time, created_at
       FROM sys_announcements
       WHERE is_published = 1
         AND (start_time IS NULL OR start_time <= ?)
         AND (end_time IS NULL OR end_time >= ?)
       ORDER BY 
         CASE priority 
           WHEN 'urgent' THEN 0 
           WHEN 'high' THEN 1 
           WHEN 'normal' THEN 2 
           WHEN 'low' THEN 3 
         END ASC,
         created_at DESC
       LIMIT 10`,
      [now, now]
    ) as any[];

    return NextResponse.json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error("获取公告列表失败:", error);
    return NextResponse.json({ success: false, error: "获取公告列表失败" }, { status: 500 });
  }
}