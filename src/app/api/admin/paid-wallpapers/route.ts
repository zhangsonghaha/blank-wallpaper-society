import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/admin/paid-wallpapers - 获取所有付费壁纸列表
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const rows = await query(
      `SELECT pw.*, i.title, i.thumbnail_url, i.width, i.height, u.nickname as creator_name
       FROM paid_wallpapers pw
       LEFT JOIN images i ON pw.image_id = i.id
       LEFT JOIN users u ON pw.user_id = u.id
       ORDER BY pw.created_at DESC`
    );

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/admin/paid-wallpapers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}