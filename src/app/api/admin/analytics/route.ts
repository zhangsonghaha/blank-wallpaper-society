import { NextRequest, NextResponse } from "next/server";
import { query, safeQuery } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/analytics - 获取运营分析数据
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    // 1. 用户统计
    const totalUsers = (await safeQuery(
      "SELECT COUNT(*) as count FROM users",
      [],
      [{ count: 0 }]
    )) as any[];

    const newUsers = (await safeQuery(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
      [String(days)],
      [{ count: 0 }]
    )) as any[];

    const activeUsers = (await safeQuery(
      "SELECT COUNT(DISTINCT user_id) as count FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
      [String(days)],
      [{ count: 0 }]
    )) as any[];

    // 2. 图片统计
    const totalImages = (await safeQuery(
      "SELECT COUNT(*) as count FROM images",
      [],
      [{ count: 0 }]
    )) as any[];

    const approvedImages = (await safeQuery(
      "SELECT COUNT(*) as count FROM images WHERE status = 'approved'",
      [],
      [{ count: 0 }]
    )) as any[];

    const pendingImages = (await safeQuery(
      "SELECT COUNT(*) as count FROM images WHERE status = 'pending'",
      [],
      [{ count: 0 }]
    )) as any[];

    // 3. 下载/浏览统计
    const totalDownloads = (await safeQuery(
      "SELECT COUNT(*) as count FROM download_logs",
      [],
      [{ count: 0 }]
    )) as any[];

    const recentDownloads = (await safeQuery(
      "SELECT COUNT(*) as count FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
      [String(days)],
      [{ count: 0 }]
    )) as any[];

    const totalViews = (await safeQuery(
      "SELECT COALESCE(SUM(view_count), 0) as count FROM images",
      [],
      [{ count: 0 }]
    )) as any[];

    // 4. 分类分布
    const categoryDistribution = (await safeQuery(
      `SELECT category, COUNT(*) as count FROM images
       WHERE status = 'approved' AND category IS NOT NULL AND category != ''
       GROUP BY category ORDER BY count DESC LIMIT 10`,
      [],
      []
    )) as any[];

    // 5. 每日上传趋势（最近 days 天）
    const uploadTrend = (await safeQuery(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM images WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date`,
      [String(days)],
      []
    )) as any[];

    // 6. 每日下载趋势
    const downloadTrend = (await safeQuery(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date`,
      [String(days)],
      []
    )) as any[];

    // 7. 热门图片 Top 10
    const topImages = (await safeQuery(
      `SELECT id, title, thumbnail_url, download_count, view_count, category
       FROM images WHERE status = 'approved'
       ORDER BY download_count DESC LIMIT 10`,
      [],
      []
    )) as any[];

    // 8. 活跃创作者 Top 10
    const topCreators = (await safeQuery(
      `SELECT uploaded_by as user_id, u.name, COUNT(*) as upload_count,
              COALESCE(SUM(i.download_count), 0) as total_downloads
       FROM images i
       LEFT JOIN users u ON i.uploaded_by = u.id
       WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY uploaded_by, u.name
       ORDER BY upload_count DESC LIMIT 10`,
      [String(days)],
      []
    )) as any[];

    // 9. 新用户注册趋势
    const registrationTrend = (await safeQuery(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(created_at) ORDER BY date`,
      [String(days)],
      []
    )) as any[];

    return NextResponse.json({
      period: days,
      users: {
        total: Number(totalUsers?.[0]?.count ?? 0),
        newInPeriod: Number(newUsers?.[0]?.count ?? 0),
        activeInPeriod: Number(activeUsers?.[0]?.count ?? 0),
      },
      images: {
        total: Number(totalImages?.[0]?.count ?? 0),
        approved: Number(approvedImages?.[0]?.count ?? 0),
        pending: Number(pendingImages?.[0]?.count ?? 0),
      },
      downloads: {
        total: Number(totalDownloads?.[0]?.count ?? 0),
        recentInPeriod: Number(recentDownloads?.[0]?.count ?? 0),
      },
      views: {
        total: Number(totalViews?.[0]?.count ?? 0),
      },
      categoryDistribution,
      uploadTrend,
      downloadTrend,
      registrationTrend,
      topImages,
      topCreators,
    });
  } catch (error: any) {
    console.error("GET /api/admin/analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}