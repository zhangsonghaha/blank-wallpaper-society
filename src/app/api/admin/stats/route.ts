import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, safeExecute } from "@/lib/db";
import { sql } from "kysely";

export async function GET(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    // 并行执行所有查询（每个查询独立容错）
    const [
      totalUsersRes,
      totalImagesRes,
      totalDownloadsRes,
      totalFavoritesRes,
      totalViewsRes,
      pendingReviewRes,
      openReportsRes,
      newCommentsRes,
      recentActiveRes,
      newUsersTrendRes,
      newImagesTrendRes,
      downloadTrendRes,
      uploadTrendRes,
      categoryDistRes,
      topImagesRes,
      topCreatorsRes,
      storageRes,
      mediaTypeRes,
      resolutionRes,
      recentUsersRes,
      nsfwFlaggedRes,
    ] = await Promise.all([
      // 总用户数
      safeExecute(
        () => db.selectFrom("users").select((eb) => eb.fn.countAll().as("count")).execute(),
        [{ count: 0 }],
        "totalUsers"
      ),
      // 总图片数
      safeExecute(
        () => db.selectFrom("images").select((eb) => eb.fn.countAll().as("count")).execute(),
        [{ count: 0 }],
        "totalImages"
      ),
      // 总下载量
      safeExecute(
        () => db.selectFrom("images").select((eb) => sql`COALESCE(SUM(download_count), 0)`.as("count")).execute(),
        [{ count: 0 }],
        "totalDownloads"
      ),
      // 总收藏数
      safeExecute(
        () => db.selectFrom("favorites").select((eb) => eb.fn.countAll().as("count")).execute(),
        [{ count: 0 }],
        "totalFavorites"
      ),
      // 总浏览量
      safeExecute(
        () => db.selectFrom("images").select((eb) => sql`COALESCE(SUM(view_count), 0)`.as("count")).execute(),
        [{ count: 0 }],
        "totalViews"
      ),
      // 待审核图片数
      safeExecute(
        () => db.selectFrom("images").select((eb) => eb.fn.countAll().as("count")).where("status", "=", "pending").execute(),
        [{ count: 0 }],
        "pendingReview"
      ),
      // 待处理举报
      safeExecute(
        () => db.selectFrom("reports").select((eb) => eb.fn.countAll().as("count")).where("status", "=", "open").execute(),
        [{ count: 0 }],
        "openReports"
      ),
      // 近期新增评论
      safeExecute(
        () => db.selectFrom("comments").select((eb) => eb.fn.countAll().as("count")).where("created_at", ">=", sql<Date>`DATE_SUB(NOW(), INTERVAL ${days} DAY)`).execute(),
        [{ count: 0 }],
        "newComments"
      ),
      // 近期活跃用户数
      safeExecute(
        () => sql<{ count: number }>`SELECT COUNT(DISTINCT user_id) as count FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`.execute(db).then((r) => r.rows),
        [{ count: 0 }],
        "recentActive"
      ),
      // 每日新增用户趋势
      safeExecute(
        () => sql<{ date: string; count: number }>`SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY) GROUP BY DATE(created_at) ORDER BY date ASC`.execute(db).then((r) => r.rows),
        [],
        "newUsersTrend"
      ),
      // 每日新增图片趋势
      safeExecute(
        () => sql<{ date: string; count: number }>`SELECT DATE(created_at) as date, COUNT(*) as count FROM images WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY) GROUP BY DATE(created_at) ORDER BY date ASC`.execute(db).then((r) => r.rows),
        [],
        "newImagesTrend"
      ),
      // 每日下载趋势
      safeExecute(
        () => sql<{ date: string; count: number }>`SELECT DATE(created_at) as date, COUNT(*) as count FROM download_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY) GROUP BY DATE(created_at) ORDER BY date ASC`.execute(db).then((r) => r.rows),
        [],
        "downloadTrend"
      ),
      // 每日上传趋势
      safeExecute(
        () => sql<{ date: string; count: number }>`SELECT DATE(created_at) as date, COUNT(*) as count FROM images WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY) GROUP BY DATE(created_at) ORDER BY date ASC`.execute(db).then((r) => r.rows),
        [],
        "uploadTrend"
      ),
      // 分类分布
      safeExecute(
        () => sql<{ name: string; slug: string; count: number }>`SELECT c.name, c.slug, COUNT(i.id) as count FROM categories c LEFT JOIN images i ON i.category = c.slug AND i.status = 'approved' GROUP BY c.id, c.name, c.slug ORDER BY count DESC`.execute(db).then((r) => r.rows),
        [],
        "categoryDist"
      ),
      // 热门壁纸 Top 10
      safeExecute(
        () => db.selectFrom("images").select(["id", "title", "thumbnail_url", "url", "download_count", "view_count", "width", "height", "category"]).where("status", "=", "approved").orderBy("download_count", "desc").limit(10).execute(),
        [],
        "topImages"
      ),
      // 热门创作者 Top 10
      safeExecute(
        () => sql<{ user_id: number; name: string; avatar: string; upload_count: number; total_downloads: number; total_views: number }>`SELECT uploaded_by as user_id, u.name, u.avatar, COUNT(*) as upload_count, COALESCE(SUM(i.download_count), 0) as total_downloads, COALESCE(SUM(i.view_count), 0) as total_views FROM images i LEFT JOIN users u ON i.uploaded_by = u.id WHERE i.status = 'approved' GROUP BY uploaded_by, u.name, u.avatar ORDER BY total_downloads DESC LIMIT 10`.execute(db).then((r) => r.rows),
        [],
        "topCreators"
      ),
      // 存储用量
      safeExecute(
        () => db.selectFrom("images").select((eb) => [sql`COALESCE(SUM(file_size), 0)`.as("total_size"), eb.fn.countAll().as("file_count")]).execute(),
        [{ total_size: 0, file_count: 0 }],
        "storage"
      ),
      // 媒体类型分布
      safeExecute(
        () => sql<{ media_type: string; count: number }>`SELECT media_type, COUNT(*) as count FROM images WHERE status = 'approved' GROUP BY media_type ORDER BY count DESC`.execute(db).then((r) => r.rows),
        [],
        "mediaTypes"
      ),
      // 分辨率分布
      safeExecute(
        () => sql<{ resolution: string; count: number }>`SELECT CASE WHEN width >= 3840 THEN '4K+' WHEN width >= 2560 THEN '2K' WHEN width >= 1920 THEN '1080p' WHEN width >= 1280 THEN '720p' ELSE 'SD' END as resolution, COUNT(*) as count FROM images WHERE width > 0 AND status = 'approved' GROUP BY resolution ORDER BY MIN(width) DESC`.execute(db).then((r) => r.rows),
        [],
        "resolutions"
      ),
      // 近期注册用户
      safeExecute(
        () => db.selectFrom("users").select(["id", "name", "email", "avatar", "created_at"]).orderBy("created_at", "desc").limit(5).execute(),
        [],
        "recentUsers"
      ),
      // NSFW标记数
      safeExecute(
        () => db.selectFrom("images").select((eb) => eb.fn.countAll().as("count")).where("nsfw_flagged", "=", 1).execute(),
        [{ count: 0 }],
        "nsfwFlagged"
      ),
    ]);

    // 类型断言辅助 - 防御性处理
    const toCount = (res: any): number => {
      try {
        const rows = Array.isArray(res) ? res : [];
        return Number(rows?.[0]?.count ?? 0);
      } catch {
        return 0;
      }
    };

    const toTrend = (res: any): { date: string; count: number }[] => {
      try {
        const rows = Array.isArray(res) ? res : [];
        return rows.map((r: any) => ({
          date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date ?? ""),
          count: Number(r.count ?? 0),
        }));
      } catch {
        return [];
      }
    };

    // 补全缺失日期
    const fillTrendDates = (
      data: { date: string; count: number }[]
    ): { date: string; count: number }[] => {
      try {
        const map = new Map((data || []).map((d) => [d.date, d.count]));
        const result: { date: string; count: number }[] = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          result.push({ date: key, count: map.get(key) ?? 0 });
        }
        return result;
      } catch {
        return [];
      }
    };

    const categoryRows = Array.isArray(categoryDistRes) ? categoryDistRes : [];
    const topImageRows = Array.isArray(topImagesRes) ? topImagesRes : [];
    const topCreatorRows = Array.isArray(topCreatorsRes) ? topCreatorsRes : [];
    const storageRow = Array.isArray(storageRes) ? storageRes?.[0] : null;
    const mediaTypeRows = Array.isArray(mediaTypeRes) ? mediaTypeRes : [];
    const resolutionRows = Array.isArray(resolutionRes) ? resolutionRes : [];
    const recentUserRows = Array.isArray(recentUsersRes) ? recentUsersRes : [];

    return NextResponse.json({
      overview: {
        totalUsers: toCount(totalUsersRes),
        totalImages: toCount(totalImagesRes),
        totalDownloads: toCount(totalDownloadsRes),
        totalFavorites: toCount(totalFavoritesRes),
        totalViews: toCount(totalViewsRes),
        pendingReview: toCount(pendingReviewRes),
        openReports: toCount(openReportsRes),
        recentComments: toCount(newCommentsRes),
        recentActiveUsers: toCount(recentActiveRes),
        nsfwFlagged: toCount(nsfwFlaggedRes),
      },
      trends: {
        newUsers: fillTrendDates(toTrend(newUsersTrendRes)),
        newImages: fillTrendDates(toTrend(newImagesTrendRes)),
        downloads: fillTrendDates(toTrend(downloadTrendRes)),
        uploads: fillTrendDates(toTrend(uploadTrendRes)),
      },
      categoryDistribution: categoryRows.map((r: any) => ({
        name: String(r?.name ?? ""),
        slug: String(r?.slug ?? ""),
        count: Number(r?.count ?? 0),
      })),
      topImages: topImageRows.map((r: any) => ({
        id: Number(r?.id ?? 0),
        title: String(r?.title ?? ""),
        thumbnailUrl: String(r?.thumbnail_url || r?.url || ""),
        downloadCount: Number(r?.download_count ?? 0),
        viewCount: Number(r?.view_count ?? 0),
        width: Number(r?.width ?? 0),
        height: Number(r?.height ?? 0),
        category: String(r?.category ?? ""),
      })),
      topCreators: topCreatorRows.map((r: any) => ({
        userId: Number(r?.user_id ?? 0),
        name: String(r?.name ?? "匿名"),
        avatar: String(r?.avatar ?? ""),
        uploadCount: Number(r?.upload_count ?? 0),
        totalDownloads: Number(r?.total_downloads ?? 0),
        totalViews: Number(r?.total_views ?? 0),
      })),
      storage: {
        totalSize: Number(storageRow?.total_size ?? 0),
        fileCount: Number(storageRow?.file_count ?? 0),
      },
      mediaTypes: mediaTypeRows.map((r: any) => ({
        type: String(r?.media_type ?? "unknown"),
        count: Number(r?.count ?? 0),
      })),
      resolutions: resolutionRows.map((r: any) => ({
        resolution: String(r?.resolution ?? "unknown"),
        count: Number(r?.count ?? 0),
      })),
      recentUsers: recentUserRows.map((r: any) => ({
        id: Number(r?.id ?? 0),
        name: String(r?.name ?? ""),
        email: String(r?.email ?? ""),
        avatar: String(r?.avatar ?? ""),
        createdAt: String(r?.created_at ?? ""),
      })),
    });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    return NextResponse.json({
      overview: { totalUsers: 0, totalImages: 0, totalDownloads: 0, totalFavorites: 0, totalViews: 0, pendingReview: 0, openReports: 0, recentComments: 0, recentActiveUsers: 0, nsfwFlagged: 0 },
      trends: { newUsers: [], newImages: [], downloads: [], uploads: [] },
      categoryDistribution: [],
      topImages: [],
      topCreators: [],
      storage: { totalSize: 0, fileCount: 0 },
      mediaTypes: [],
      resolutions: [],
      recentUsers: [],
    });
  }
}
