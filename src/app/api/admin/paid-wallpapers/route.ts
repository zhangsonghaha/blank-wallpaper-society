import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/paid-wallpapers - 获取所有付费壁纸列表
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const rows = await db
      .selectFrom("paid_wallpapers as pw")
      .leftJoin("images as i", "pw.image_id", "i.id")
      .leftJoin("users as u", "pw.user_id", "u.id")
      .selectAll()
      .orderBy("pw.created_at", "desc")
      .execute();

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    console.error("GET /api/admin/paid-wallpapers error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}