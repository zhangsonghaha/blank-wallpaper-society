import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET /api/user/usage - 获取当前用户会员额度使用情况
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const isAdmin = (session.user as any).role === "admin";
    const membership = (session.user as any)?.membership as {
      plan: string;
      startedAt: string;
      expiresAt: string;
      status: string;
    } | null;

    const isMember = !!membership && membership.status === "active";
    const isEnterprise = membership?.plan?.includes("enterprise");

    // 确定用户等级
    const tier = isAdmin
      ? "admin"
      : isEnterprise
        ? "enterprise"
        : isMember
          ? "pro"
          : "free";

    // === 下载配额 ===
    // 免费用户5次/天，Pro无限，企业无限
    const downloadLimit = tier === "free" ? 5 : -1; // -1 表示无限
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const downloadRows = await db
      .selectFrom("download_logs")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("user_id", "=", Number(userId))
      .where("created_at", ">=", todayStart)
      .execute();
    const downloadsToday = Number(downloadRows[0]?.count) || 0;

    // === AI 生成配额 ===
    // 免费用户3次/天，Pro 30次/天，企业无限
    const aiLimit = tier === "free" ? 3 : tier === "pro" ? 30 : -1;
    const aiRows = await db
      .selectFrom("ai_generations")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("user_id", "=", Number(userId))
      .where("created_at", ">=", todayStart)
      .where("status", "in", ["completed", "processing"])
      .execute();
    const aiUsedToday = Number(aiRows[0]?.count) || 0;

    // === 收藏数 ===
    const favRows = await db
      .selectFrom("favorites")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("user_id", "=", Number(userId))
      .execute();
    const favoriteCount = Number(favRows[0]?.count) || 0;

    // === 上传数 ===
    const uploadRows = await db
      .selectFrom("images")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("uploaded_by", "=", Number(userId))
      .execute();
    const uploadCount = Number(uploadRows[0]?.count) || 0;

    // === 存储使用 ===
    const storageRows = await sql<{ total: string }>`
      SELECT COALESCE(SUM(file_size), 0) as total FROM images WHERE uploaded_by = ${Number(userId)}
    `.execute(db);
    const storageUsedMB = Math.round(
      Number(storageRows.rows[0]?.total || 0) / 1024 / 1024
    );
    const storageLimitMB =
      tier === "free" ? 500 : tier === "admin" ? 10000 : 2000;

    // === 会员到期信息 ===
    let expiresAt: string | null = null;
    let daysRemaining: number | null = null;
    if (membership?.expiresAt) {
      expiresAt = membership.expiresAt;
      const exp = new Date(membership.expiresAt);
      const now = new Date();
      daysRemaining = Math.max(
        0,
        Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
    }

    return NextResponse.json({
      tier,
      plan: membership?.plan || (isAdmin ? "admin" : "free"),
      downloads: {
        usedToday: downloadsToday,
        dailyLimit: downloadLimit,
        remaining:
          downloadLimit === -1
            ? -1
            : Math.max(0, downloadLimit - downloadsToday),
      },
      aiGenerate: {
        usedToday: aiUsedToday,
        dailyLimit: aiLimit,
        remaining:
          aiLimit === -1 ? -1 : Math.max(0, aiLimit - aiUsedToday),
      },
      storage: {
        usedMB: storageUsedMB,
        limitMB: storageLimitMB,
        usagePercent: Math.round((storageUsedMB / storageLimitMB) * 100),
      },
      favorites: favoriteCount,
      uploads: uploadCount,
      membership: {
        isActive: isMember || isAdmin,
        expiresAt,
        daysRemaining,
      },
    });
  } catch (error: any) {
    console.error("GET /api/user/usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
