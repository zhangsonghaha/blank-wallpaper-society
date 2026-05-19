import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

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
    const tier = isAdmin ? "admin" : isEnterprise ? "enterprise" : isMember ? "pro" : "free";

    // === 下载配额 ===
    // 免费用户5次/天，Pro无限，企业无限
    const downloadLimit = tier === "free" ? 5 : -1; // -1 表示无限
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString().slice(0, 19).replace("T", " ");

    const downloadRows = (await query(
      "SELECT COUNT(*) as count FROM download_logs WHERE user_id = ? AND created_at >= ?",
      [userId, todayStr]
    )) as any[];
    const downloadsToday = downloadRows[0]?.count || 0;

    // === AI 生成配额 ===
    // 免费用户3次/天，Pro 30次/天，企业无限
    const aiLimit = tier === "free" ? 3 : tier === "pro" ? 30 : -1;
    const aiRows = (await query(
      "SELECT COUNT(*) as count FROM ai_generations WHERE user_id = ? AND created_at >= ? AND status IN ('completed', 'processing')",
      [userId, todayStr]
    )) as any[];
    const aiUsedToday = aiRows[0]?.count || 0;

    // === 收藏数 ===
    const favRows = (await query(
      "SELECT COUNT(*) as count FROM favorites WHERE user_id = ?",
      [userId]
    )) as any[];
    const favoriteCount = favRows[0]?.count || 0;

    // === 上传数 ===
    const uploadRows = (await query(
      "SELECT COUNT(*) as count FROM images WHERE uploaded_by = ?",
      [userId]
    )) as any[];
    const uploadCount = uploadRows[0]?.count || 0;

    // === 存储使用 ===
    const storageRows = (await query(
      "SELECT COALESCE(SUM(file_size), 0) as total FROM images WHERE uploaded_by = ?",
      [userId]
    )) as any[];
    const storageUsedMB = Math.round(Number(storageRows[0]?.total || 0) / 1024 / 1024);
    const storageLimitMB = tier === "free" ? 500 : tier === "admin" ? 10000 : 2000;

    // === 会员到期信息 ===
    let expiresAt: string | null = null;
    let daysRemaining: number | null = null;
    if (membership?.expiresAt) {
      expiresAt = membership.expiresAt;
      const exp = new Date(membership.expiresAt);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    return NextResponse.json({
      tier,
      plan: membership?.plan || (isAdmin ? "admin" : "free"),
      downloads: {
        usedToday: downloadsToday,
        dailyLimit: downloadLimit,
        remaining: downloadLimit === -1 ? -1 : Math.max(0, downloadLimit - downloadsToday),
      },
      aiGenerate: {
        usedToday: aiUsedToday,
        dailyLimit: aiLimit,
        remaining: aiLimit === -1 ? -1 : Math.max(0, aiLimit - aiUsedToday),
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