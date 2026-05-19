import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";
import { clearPattern } from "@/lib/redis";
import crypto from "crypto";

// GET /api/admin/membership/redeem-codes - 获取兑换码列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "";
    const plan = searchParams.get("plan") || "";
    const batch = searchParams.get("batch") || "";
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push("rc.status = ?");
      params.push(status);
    }
    if (plan) {
      conditions.push("rc.plan = ?");
      params.push(plan);
    }
    if (batch) {
      conditions.push("rc.batch_name LIKE ?");
      params.push(`%${batch}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 获取总数
    const countResult = await query(
      `SELECT COUNT(*) as count FROM membership_redeem_codes rc ${whereClause}`,
      params
    ) as any[];
    const total = Number(countResult[0]?.count ?? 0);

    // 获取列表
    const codes = await query(
      `SELECT rc.*, u.name as creator_name
       FROM membership_redeem_codes rc
       LEFT JOIN users u ON rc.created_by = u.id
       ${whereClause}
       ORDER BY rc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ) as any[];

    return NextResponse.json({
      data: codes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error("GET /api/admin/membership/redeem-codes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/membership/redeem-codes - 生成兑换码
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const operatorId = (session.user as any).id;
    const body = await request.json();
    const { plan, count = 1, maxUses = 1, batchName, note, expiresInDays, customCode } = body;

    // 验证套餐类型
    if (!["monthly", "yearly"].includes(plan)) {
      return NextResponse.json({ error: "无效的套餐类型" }, { status: 400 });
    }

    // 验证数量
    const codeCount = Math.min(Math.max(parseInt(count) || 1, 1), 100);
    const usesPerCode = Math.min(Math.max(parseInt(maxUses) || 1, 1), 1000);

    // 有效天数
    const durationDays = plan === "monthly" ? 30 : 365;

    // 兑换码过期时间
    let codeExpiresAt: string | null = null;
    if (expiresInDays) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiresInDays));
      codeExpiresAt = d.toISOString().slice(0, 19).replace("T", " ");
    }

    // 生成兑换码
    const generatedCodes: string[] = [];

    await withTransaction(async (conn) => {
      for (let i = 0; i < codeCount; i++) {
        const code = customCode && codeCount === 1
          ? customCode
          : generateRedeemCode();

        // 检查是否已存在
        const [existing] = await conn.execute(
          "SELECT id FROM membership_redeem_codes WHERE code = ?",
          [code]
        ) as [any[], any];

        if (existing.length > 0) {
          if (customCode) {
            throw new Error("兑换码已存在");
          }
          i--; // 重试
          continue;
        }

        await conn.execute(
          `INSERT INTO membership_redeem_codes (code, plan, duration_days, max_uses, created_by, batch_name, note, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, plan, durationDays, usesPerCode, operatorId, batchName || null, note || null, codeExpiresAt]
        );

        generatedCodes.push(code);
      }
    });

    // 记录操作日志
    await query(
      "INSERT INTO admin_operation_logs (operator_id, operation, detail) VALUES (?, ?, ?)",
      [operatorId, "generate_redeem_codes", JSON.stringify({
        plan,
        count: generatedCodes.length,
        batchName,
        maxUses: usesPerCode,
      })]
    );

    return NextResponse.json({
      success: true,
      codes: generatedCodes,
      count: generatedCodes.length,
    });
  } catch (error: any) {
    console.error("POST /api/admin/membership/redeem-codes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 生成兑换码：格式 BWS-XXXX-XXXX-XXXX
function generateRedeemCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉容易混淆的字符
  const segment = () => {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += chars[crypto.randomInt(chars.length)];
    }
    return s;
  };
  return `BWS-${segment()}-${segment()}-${segment()}`;
}