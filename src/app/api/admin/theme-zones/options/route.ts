import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET /api/admin/theme-zones/options - 获取可用分类和标签选项
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 获取所有分类及其图片数量（兼容 category 字段存储 slug 或中文名两种情况）
    const categories = await sql<{ id: string; name: string; count: number }>`SELECT 
        c.slug as id, 
        c.name as name, 
        COUNT(i.id) as count
      FROM categories c
      LEFT JOIN images i ON (i.category = c.slug OR i.category = c.name)
        AND i.status = 'approved' 
        AND i.media_type != 'video'
      GROUP BY c.slug, c.name
      ORDER BY count DESC`.execute(db);

    // 获取热门标签（从 tags 字段提取）
    const allTags = await db.selectFrom("images")
      .where("status", "=", "approved")
      .where("media_type", "!=", "video")
      .where("tags", "is not", null)
      .where("tags", "!=", "")
      .select(["tags"])
      .execute();

    // 统计标签频率
    const tagCounts = new Map<string, number>();
    allTags.forEach(row => {
      if (row.tags) {
        // 假设 tags 是逗号分隔的字符串或 JSON 数组
        let tags: string[] = [];
        if (typeof row.tags === 'string') {
          try {
            // 尝试解析 JSON 数组
            tags = JSON.parse(row.tags);
          } catch {
            // 回退到逗号分隔
            tags = row.tags.split(',').map((t: string) => t.trim());
          }
        } else if (Array.isArray(row.tags)) {
          tags = row.tags as unknown as string[];
        }

        tags.forEach(tag => {
          if (tag && tag.length > 0) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        });
      }
    });

    // 转换为数组并排序
    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 取前 20 个

    return NextResponse.json({
      categories: categories.rows,
      popular_tags: popularTags,
    });
  } catch (error: any) {
    console.error("GET /api/admin/theme-zones/options error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}
