import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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
    const statusParam = searchParams.get("status") || "";
    const planParam = searchParams.get("plan") || "";
    const batchParam = searchParams.get("batch") || "";
    const offset = (page - 1) * limit;

    // 获取总数
    const countResult = await db
      .selectFrom("membership_redeem_codes as rc")
      .select((eb) => eb.fn.countAll().as("count"))
      .$if(!!statusParam, (qb) => qb.where("rc.status", "=", statusParam as "active" | "disabled" | "expired"))
      .$if(!!planParam, (qb) => qb.where("rc.plan", "=", planParam as "monthly" | "yearly"))
      .$if(!!batchParam, (qb) => qb.where("rc.batch_name", "like", `%${batchParam}%`))
      .executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    // 获取列表
    const codes = await db
      .selectFrom("membership_redeem_codes as rc")
      .leftJoin("users as u", "rc.created_by", "u.id")
      .selectAll("rc")
      .select(["u.name as creator_name"])
      .$if(!!statusParam, (qb) => qb.where("rc.status", "=", statusParam as "active" | "disabled" | "expired"))
      .$if(!!planParam, (qb) => qb.where("rc.plan", "=", planParam as "monthly" | "yearly"))
      .$if(!!batchParam, (qb) => qb.where("rc.batch_name", "like", `%${batchParam}%`))
      .orderBy("rc.created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

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
    let codeExpiresAt: Date | null = null;
    if (expiresInDays) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(expiresInDays));
      codeExpiresAt = d;
    }

    // 生成兑换码
    const generatedCodes: string[] = [];

    await db.transaction().execute(async (trx) => {
      for (let i = 0; i < codeCount; i++) {
        const code = customCode && codeCount === 1
          ? customCode
          : generateRedeemCode();

        // 检查是否已存在
        const existing = await trx
          .selectFrom("membership_redeem_codes")
          .select("id")
          .where("code", "=", code)
          .execute();

        if (existing.length > 0) {
          if (customCode) {
            throw new Error("兑换码已存在");
          }
          i--; // 重试
          continue;
        }

        await trx.insertInto("membership_redeem_codes").values({
          code,
          plan,
          duration_days: durationDays,
          max_uses: usesPerCode,
          created_by: operatorId,
          batch_name: batchName || null,
          note: note || null,
          expires_at: codeExpiresAt,
        }).execute();

        generatedCodes.push(code);
      }
    });

    // 记录操作日志
    await db.insertInto("admin_operation_logs").values({
      operator_id: operatorId,
      operation: "generate_redeem_codes",
      detail: JSON.stringify({
        plan,
        count: generatedCodes.length,
        batchName,
        maxUses: usesPerCode,
      }),
    }).execute();

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
