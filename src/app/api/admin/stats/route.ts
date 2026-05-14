import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { safeQuery } from "@/lib/db";

export async function GET() {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 并行执行所有查询（每个查询独立容错）
    const [
      totalUsersRes,
      totalImagesRes,
      totalDownloadsRes,
      totalFavoritesRes,
      recentActiveRes,
      newUsersTrendRes,
      newImagesTrendRes,
      downloadTrendRes,
      categoryDistRes,
      topImagesRes,
      storageRes,
    ] = await Promise.all([
      // 总用户数
      safeQuery("SELECT COUNT(*) as count FROM users", undefined, [{ count: 0 }]),
      // 总图片数
      safeQuery("SELECT COUNT(*) as count FROM images", undefined, [{ count: 0 }]),
      // 总下载量
      safeQuery("SELECT COALESCE(SUM(download_count), 0) as count FROM images", undefined, [{ count: 0 }]),
      // 总收藏数
      safeQuery("SELECT COUNT(*) as count FROM favorites", undefined, [{ count: 0 }]),
      // 近7天活跃用户数
      safeQuery(
        "SELECT COUNT(DISTINCT user_id) as count FROM favorites WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
        undefined,
        [{ count: 0 }]
      ),
      // 近30天每日新增用户
      safeQuery(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM users 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date ASC`,
        undefined,
        []
      ),
      // 近30天每日新增图片
      safeQuery(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM images 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date ASC`,
        undefined,
        []
      ),
      // 近30天每日下载量
      safeQuery(
        `SELECT DATE(created_at) as date, SUM(download_count) as count 
         FROM images 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date ASC`,
        undefined,
        []
      ),
      // 分类分布
      safeQuery(
        `SELECT c.name, c.slug, COUNT(i.id) as count 
         FROM categories c 
         LEFT JOIN images i ON i.category_id = c.id 
         GROUP BY c.id, c.name, c.slug 
         ORDER BY count DESC`,
        undefined,
        []
      ),
      // 热门壁纸 Top 10
      safeQuery(
        `SELECT id, title, thumbnail_url, url, download_count, width, height 
         FROM images 
         ORDER BY download_count DESC 
         LIMIT 10`,
        undefined,
        []
      ),
      // 存储用量
      safeQuery(
        "SELECT COALESCE(SUM(file_size), 0) as total_size, COUNT(*) as file_count FROM images",
        undefined,
        [{ total_size: 0, file_count: 0 }]
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

    // 补全30天缺失日期
    const fillTrendDates = (
      data: { date: string; count: number }[]
    ): { date: string; count: number }[] => {
      try {
        const map = new Map((data || []).map((d) => [d.date, d.count]));
        const result: { date: string; count: number }[] = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
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
    const storageRow = Array.isArray(storageRes) ? storageRes?.[0] : null;

    return NextResponse.json({
      overview: {
        totalUsers: toCount(totalUsersRes),
        totalImages: toCount(totalImagesRes),
        totalDownloads: toCount(totalDownloadsRes),
        totalFavorites: toCount(totalFavoritesRes),
        recentActiveUsers: toCount(recentActiveRes),
      },
      trends: {
        newUsers: fillTrendDates(toTrend(newUsersTrendRes)),
        newImages: fillTrendDates(toTrend(newImagesTrendRes)),
        downloads: fillTrendDates(toTrend(downloadTrendRes)),
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
        width: Number(r?.width ?? 0),
        height: Number(r?.height ?? 0),
      })),
      storage: {
        totalSize: Number(storageRow?.total_size ?? 0),
        fileCount: Number(storageRow?.file_count ?? 0),
      },
    });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    // 返回默认值而非500错误，让前端能正常展示
    return NextResponse.json({
      overview: { totalUsers: 0, totalImages: 0, totalDownloads: 0, totalFavorites: 0, recentActiveUsers: 0 },
      trends: { newUsers: [], newImages: [], downloads: [] },
      categoryDistribution: [],
      topImages: [],
      storage: { totalSize: 0, fileCount: 0 },
    });
  }
}