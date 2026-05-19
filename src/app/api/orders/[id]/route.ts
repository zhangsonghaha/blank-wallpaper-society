import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/orders/[id] - 获取订单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { id } = await params;

    const rows = (await query(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?",
      [id, userId]
    )) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error: any) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}