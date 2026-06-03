import { NextResponse } from "next/server";
import { db, safeExecute } from "@/lib/db";

// GET /api/search/hot - 获取热门搜索词
export async function GET() {
  try {
    // 基于下载量和浏览量聚合热门标签和分类
    const hotTags = await safeExecute(
      () => db
        .selectFrom("images")
        .select("tags")
        .where("status", "=", "approved")
        .where("tags", "is not", null)
        .where("tags", "!=", "")
        .where("tags", "!=", "[]")
        .orderBy("download_count", "desc")
        .limit(50)
        .execute(),
      [],
      "search-hot-tags"
    );

    // 统计标签频率
    const tagCount: Record<string, number> = {};
    for (const row of hotTags) {
      if (!row.tags) continue;
      try {
        const parsed = JSON.parse(row.tags as string);
        if (Array.isArray(parsed)) {
          for (const tag of parsed) {
            if (typeof tag === "string" && tag.trim()) {
              tagCount[tag.trim()] = (tagCount[tag.trim()] || 0) + 1;
            }
          }
        }
      } catch {
        // 非JSON格式，按逗号分割
        const parts = (row.tags as string).split(",");
        for (const part of parts) {
          const t = part.trim();
          if (t) tagCount[t] = (tagCount[t] || 0) + 1;
        }
      }
    }

    // 取 Top 10 热门标签
    const hotKeywords = Object.entries(tagCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword]) => keyword);

    return NextResponse.json({ hot: hotKeywords });
  } catch (error) {
    console.error("GET /api/search/hot error:", error);
    return NextResponse.json({ hot: [] });
  }
}
