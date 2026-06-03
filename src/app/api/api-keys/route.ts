import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiKeyUsageStats } from "@/lib/rate-limit";
import { sql } from "kysely";

// 生成随机API Key
function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const crypto = require("crypto");
  // 生成32字节随机数据，编码为hex
  const rawKey = `bws_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 8); // "bws_xxxx"
  return { rawKey, keyHash, keyPrefix };
}

// 默认API Key有效期：90天
const DEFAULT_KEY_EXPIRY_DAYS = 90;

// GET /api/api-keys - 获取当前用户的API Key列表
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const rows = await db
      .selectFrom("api_keys")
      .select(["id", "key_prefix", "name", "rate_limit", "is_active", "created_at", "last_used_at", "expires_at"])
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();

    // 标记已过期的Key为不活跃，并遮蔽敏感信息
    const now = new Date();
    const processedRows = rows.map((row) => {
      const isExpired = row.expires_at && new Date(row.expires_at as any) < now;
      return {
        ...row,
        is_active: isExpired ? false : row.is_active,
        is_expired: isExpired,
        // 前缀显示: bws_****xxxx (仅展示前4+后4位)
        key_preview: `${row.key_prefix}****`,
      };
    });

    // 获取每个key的使用统计
    const keysWithStats = await Promise.all(
      processedRows.map(async (row) => {
        const stats = await getApiKeyUsageStats(row.id);
        return {
          ...row,
          usage: stats,
        };
      })
    );

    return NextResponse.json({ data: keysWithStats });
  } catch (error: any) {
    console.error("GET /api/api-keys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/api-keys - 创建新的API Key
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { name, rate_limit, expires_in_days } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Key名称不能为空" }, { status: 400 });
    }

    // 检查用户已有Key数量（最多5个，不含已过期的）
    const existing = await db
      .selectFrom("api_keys")
      .select((eb) => [eb.fn.count<number>("id").as("count")])
      .where("user_id", "=", userId)
      .where((eb) => eb.or([
        eb("expires_at", "is", null),
        eb("expires_at", ">", sql<Date>`NOW()`),
      ]))
      .executeTakeFirst();

    if (Number(existing?.count ?? 0) >= 5) {
      return NextResponse.json(
        { error: "每个用户最多创建5个有效API Key" },
        { status: 400 }
      );
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const limit = rate_limit || 1000;

    // 计算过期时间：默认90天，0表示永不过期
    const expiryDays = expires_in_days !== undefined ? expires_in_days : DEFAULT_KEY_EXPIRY_DAYS;
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db
      .insertInto("api_keys")
      .values({
        user_id: userId,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: name.trim(),
        rate_limit: limit,
        expires_at: expiresAt,
      })
      .executeTakeFirst();

    // 创建后只返回一次完整Key
    return NextResponse.json(
      {
        data: {
          id: Number(result.insertId),
          key_prefix: keyPrefix,
          name: name.trim(),
          rate_limit: limit,
          is_active: true,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
          key: rawKey, // 完整Key，仅此一次展示
        },
        warning: "请妥善保存API Key，创建后仅显示一次完整Key。",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/api-keys error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
