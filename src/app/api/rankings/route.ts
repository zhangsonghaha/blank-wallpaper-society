import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// 缓存：内存缓存1小时
let rankingsCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1小时

function getDateCondition(period: string): string {
  switch (period) {
    case "daily":
      return "AND created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";
    case "weekly":
      return "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    case "monthly":
      return "AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    case "all":
    default:
      return "";
  }
}

function getLogTable(type: string): string {
  switch (type) {
    case "downloads":
      return "download_logs";
    case "views":
      return "view_logs";
    case "favorites":
      return ""; // favorites 用 images 表的 is_favorite
    default:
      return "download_logs";
  }
}

// GET /api/rankings?period=daily&type=downloads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "weekly";
    const type = searchParams.get("type") || "downloads";

    // 检查缓存
    const cacheKey = `${period}_${type}`;
    const cached = rankingsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(
        { data: cached.data, cached: true },
        {
          headers: {
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
          },
        }
      );
    }

    let rows: any[];

    if (type === "favorites") {
      // 收藏排行：用 images 表的 is_favorite 字段
      // is_favorite 为 1 表示被收藏，按下载/浏览热度排序已收藏的图片
      const sql = `
        SELECT 
          i.id, i.title, i.description, i.url, i.thumbnail_url, 
          i.width, i.height, i.author, i.tags, i.category,
          i.download_count, i.view_count,
          i.is_favorite AS favorite_count
        FROM images i
        WHERE i.status = 'approved' AND i.is_favorite = 1
        ORDER BY i.download_count DESC, i.view_count DESC
        LIMIT 50
      `;
      rows = (await query(sql)) as any[];
    } else {
      // 下载/浏览排行：用日志表
      const logTable = getLogTable(type);
      const dateCondition = getDateCondition(period);

      const sql = `
        SELECT 
          i.id, i.title, i.description, i.url, i.thumbnail_url, 
          i.width, i.height, i.author, i.tags, i.category,
          i.download_count, i.view_count,
          l.log_count
        FROM images i
        INNER JOIN (
          SELECT image_id, COUNT(*) AS log_count
          FROM ${logTable}
          WHERE 1=1 ${dateCondition}
          GROUP BY image_id
          ORDER BY log_count DESC
          LIMIT 50
        ) l ON l.image_id = i.id
        WHERE i.status = 'approved'
        ORDER BY l.log_count DESC
      `;
      rows = (await query(sql)) as any[];
    }

    // 格式化结果，添加排名
    const rankings = rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      title: row.title,
      description: row.description,
      url: row.url,
      thumbnail_url: row.thumbnail_url,
      width: row.width,
      height: row.height,
      author: row.author,
      tags: row.tags,
      category: row.category,
      download_count: row.download_count,
      view_count: row.view_count,
      favorite_count: row.favorite_count || 0,
      log_count: row.log_count || 0,
    }));

    // 更新缓存
    rankingsCache[cacheKey] = { data: rankings, timestamp: Date.now() };

    return NextResponse.json(
      { data: rankings, cached: false },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("获取排行榜失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}