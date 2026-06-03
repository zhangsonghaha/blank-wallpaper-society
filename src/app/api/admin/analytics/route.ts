import { NextRequest, NextResponse } from "next/server";
import { db, safeExecute } from "@/lib/db";
import { sql } from "kysely";
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
    const daysStr = String(days);

    // 1. 用户统计
    const totalUsers = await safeExecute(
      () => db.selectFrom("users").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
      { count: 0 }
    );

    const newUsers = await safeExecute(
      () => sql<{ count: string | number }>`SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)`.execute(db),
      { rows: [{ count: 0 }] },
      "new-users"
    );

    const activeUsers = await safeExecute(
      () => sql<{ count: string | number }>`SELECT COUNT(DISTINCT user_id) as count FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)`.execute(db),
      { rows: [{ count: 0 }] },
      "active-users"
    );

    // 2. 图片统计
    const totalImages = await safeExecute(
      () => db.selectFrom("images").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
      { count: 0 }
    );

    const approvedImages = await safeExecute(
      () => db.selectFrom("images").where("status", "=", "approved").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
      { count: 0 }
    );

    const pendingImages = await safeExecute(
      () => db.selectFrom("images").where("status", "=", "pending").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
      { count: 0 }
    );

    // 3. 下载/浏览统计
    const totalDownloads = await safeExecute(
      () => db.selectFrom("download_logs").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
      { count: 0 }
    );

    const recentDownloads = await safeExecute(
      () => sql<{ count: string | number }>`SELECT COUNT(*) as count FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)`.execute(db),
      { rows: [{ count: 0 }] },
      "recent-downloads"
    );

    const totalViews = await safeExecute(
      () => sql<{ count: string | number }>`SELECT COALESCE(SUM(view_count), 0) as count FROM images`.execute(db),
      { rows: [{ count: 0 }] },
      "total-views"
    );

    // 4. 分类分布
    const categoryDistribution = await safeExecute(
      () => db.selectFrom("images")
        .where("status", "=", "approved")
        .where("category", "is not", null)
        .where("category", "!=", "")
        .select((eb) => ["category", eb.fn.countAll().as("count")])
        .groupBy("category")
        .orderBy("count", "desc")
        .limit(10)
        .execute(),
      [] as any[],
      "category-dist"
    );

    // 5. 每日上传趋势
    const uploadTrend = await safeExecute(
      () => sql<{ date: string; count: string | number }>`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM images WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)
       GROUP BY DATE(created_at) ORDER BY date`.execute(db),
      { rows: [] } as { rows: any[] },
      "upload-trend"
    );

    // 6. 每日下载趋势
    const downloadTrend = await safeExecute(
      () => sql<{ date: string; count: string | number }>`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)
       GROUP BY DATE(created_at) ORDER BY date`.execute(db),
      { rows: [] } as { rows: any[] },
      "download-trend"
    );

    // 7. 热门图片 Top 10
    const topImages = await safeExecute(
      () => db.selectFrom("images")
        .where("status", "=", "approved")
        .select(["id", "title", "thumbnail_url", "download_count", "view_count", "category"])
        .orderBy("download_count", "desc")
        .limit(10)
        .execute(),
      [] as any[],
      "top-images"
    );

    // 8. 活跃创作者 Top 10
    const topCreators = await safeExecute(
      () => sql<{ user_id: number; name: string; upload_count: string | number; total_downloads: string | number }>`SELECT uploaded_by as user_id, u.name, COUNT(*) as upload_count,
              COALESCE(SUM(i.download_count), 0) as total_downloads
       FROM images i
       LEFT JOIN users u ON i.uploaded_by = u.id
       WHERE i.created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)
       GROUP BY uploaded_by, u.name
       ORDER BY upload_count DESC LIMIT 10`.execute(db),
      { rows: [] } as { rows: any[] },
      "top-creators"
    );

    // 9. 新用户注册趋势
    const registrationTrend = await safeExecute(
      () => sql<{ date: string; count: string | number }>`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${sql.raw(daysStr)} DAY)
       GROUP BY DATE(created_at) ORDER BY date`.execute(db),
      { rows: [] } as { rows: any[] },
      "registration-trend"
    );

    return NextResponse.json({
      period: days,
      users: {
        total: Number(totalUsers?.count ?? 0),
        newInPeriod: Number(newUsers.rows?.[0]?.count ?? 0),
        activeInPeriod: Number(activeUsers.rows?.[0]?.count ?? 0),
      },
      images: {
        total: Number(totalImages?.count ?? 0),
        approved: Number(approvedImages?.count ?? 0),
        pending: Number(pendingImages?.count ?? 0),
      },
      downloads: {
        total: Number(totalDownloads?.count ?? 0),
        recentInPeriod: Number(recentDownloads.rows?.[0]?.count ?? 0),
      },
      views: {
        total: Number(totalViews.rows?.[0]?.count ?? 0),
      },
      categoryDistribution,
      uploadTrend: uploadTrend.rows,
      downloadTrend: downloadTrend.rows,
      registrationTrend: registrationTrend.rows,
      topImages,
      topCreators: topCreators.rows,
    });
  } catch (error: any) {
    console.error("GET /api/admin/analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
