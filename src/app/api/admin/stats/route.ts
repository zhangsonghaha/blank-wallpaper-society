import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 并行执行所有查询
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
      query("SELECT COUNT(*) as count FROM users"),
      // 总图片数
      query("SELECT COUNT(*) as count FROM images"),
      // 总下载量
      query("SELECT COALESCE(SUM(download_count), 0) as count FROM images"),
      // 总收藏数
      query("SELECT COUNT(*) as count FROM favorites"),
      // 近7天活跃用户数
      query(
        "SELECT COUNT(DISTINCT user_id) as count FROM favorites WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
      ),
      // 近30天每日新增用户
      query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM users 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date ASC`
      ),
      // 近30天每日新增图片
      query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM images 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date ASC`
      ),
      // 近30天每日下载量
      query(
        `SELECT DATE(created_at) as date, SUM(download_count) as count 
         FROM images 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date ASC`
      ),
      // 分类分布
      query(
        `SELECT c.name, c.slug, COUNT(i.id) as count 
         FROM categories c 
         LEFT JOIN images i ON i.category_id = c.id 
         GROUP BY c.id, c.name, c.slug 
         ORDER BY count DESC`
      ),
      // 热门壁纸 Top 10
      query(
        `SELECT id, title, thumbnail_url, url, download_count, width, height 
         FROM images 
         ORDER BY download_count DESC 
         LIMIT 10`
      ),
      // 存储用量
      query(
        "SELECT COALESCE(SUM(file_size), 0) as total_size, COUNT(*) as file_count FROM images"
      ),
    ]);

    // 类型断言辅助
    const toCount = (res: any): number => {
      const rows = res as any[];
      return rows?.[0]?.count ?? 0;
    };

    const toTrend = (res: any): { date: string; count: number }[] => {
      const rows = res as any[];
      return rows.map((r) => ({
        date: r.date instanceof Date ? r.date.toISOString().split("T")[0] : String(r.date),
        count: Number(r.count),
      }));
    };

    // 补全30天缺失日期
    const fillTrendDates = (
      data: { date: string; count: number }[]
    ): { date: string; count: number }[] => {
      const map = new Map(data.map((d) => [d.date, d.count]));
      const result: { date: string; count: number }[] = [];
      const now = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        result.push({ date: key, count: map.get(key) ?? 0 });
      }
      return result;
    };

    const categoryRows = categoryDistRes as any[];
    const topImageRows = topImagesRes as any[];
    const storageRow = (storageRes as any[])?.[0];

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
      categoryDistribution: categoryRows.map((r) => ({
        name: r.name,
        slug: r.slug,
        count: Number(r.count),
      })),
      topImages: topImageRows.map((r) => ({
        id: r.id,
        title: r.title,
        thumbnailUrl: r.thumbnail_url || r.url,
        downloadCount: Number(r.download_count),
        width: r.width,
        height: r.height,
      })),
      storage: {
        totalSize: Number(storageRow?.total_size ?? 0),
        fileCount: Number(storageRow?.file_count ?? 0),
      },
    });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}