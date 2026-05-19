import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/user/membership - 获取当前用户会员信息
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 管理员直接返回最高权限
    if ((session.user as any).role === "admin") {
      return NextResponse.json({
        membership: {
          plan: "admin",
          startedAt: null,
          expiresAt: null,
          status: "active",
        },
      });
    }

    const rows = (await query(
      "SELECT plan, started_at, expires_at, status FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1",
      [userId]
    )) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ membership: null });
    }

    const m = rows[0];
    return NextResponse.json({
      membership: {
        plan: m.plan,
        startedAt: m.started_at,
        expiresAt: m.expires_at,
        status: m.status,
      },
    });
  } catch (error: any) {
    console.error("GET /api/user/membership error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}