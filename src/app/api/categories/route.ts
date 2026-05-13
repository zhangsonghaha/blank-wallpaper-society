import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/categories - 获取分类列表
export async function GET() {
  try {
    const rows = await query(
      "SELECT * FROM categories ORDER BY sort_order ASC"
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}