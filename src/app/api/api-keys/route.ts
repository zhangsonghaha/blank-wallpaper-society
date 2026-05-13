import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getApiKeyUsageStats } from "@/lib/rate-limit";

// 生成随机API Key
function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const crypto = require("crypto");
  // 生成32字节随机数据，编码为hex
  const rawKey = `bws_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 8); // "bws_xxxx"
  return { rawKey, keyHash, keyPrefix };
}

// GET /api/api-keys - 获取当前用户的API Key列表
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const rows = (await query(
      `SELECT id, key_prefix, name, rate_limit, is_active, created_at, last_used_at 
       FROM api_keys 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    )) as any[];

    // 获取每个key的使用统计
    const keysWithStats = await Promise.all(
      rows.map(async (row) => {
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
    const { name, rate_limit } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Key名称不能为空" }, { status: 400 });
    }

    // 检查用户已有Key数量（最多5个）
    const existing = (await query(
      "SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?",
      [userId]
    )) as any[];

    if (existing[0]?.count >= 5) {
      return NextResponse.json(
        { error: "每个用户最多创建5个API Key" },
        { status: 400 }
      );
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const limit = rate_limit || 1000;

    const result = (await query(
      `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, rate_limit) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, keyHash, keyPrefix, name.trim(), limit]
    )) as any;

    // 创建后只返回一次完整Key
    return NextResponse.json(
      {
        data: {
          id: result.insertId,
          key_prefix: keyPrefix,
          name: name.trim(),
          rate_limit: limit,
          is_active: true,
          created_at: new Date().toISOString(),
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