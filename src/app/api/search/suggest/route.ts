import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isMeilisearchAvailable, searchSuggestions } from "@/lib/meilisearch";

// GET /api/search/suggest?q=keyword - 搜索建议
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q || q.length < 1) {
      return NextResponse.json({ suggestions: [], hot: [] });
    }

    // 优先使用 Meilisearch 搜索建议
    const meiliAvailable = await isMeilisearchAvailable();
    if (meiliAvailable) {
      const meiliResult = await searchSuggestions(q);
      if (meiliResult && meiliResult.suggestions.length > 0) {
        return NextResponse.json({
          suggestions: meiliResult.suggestions,
          _searchEngine: "meilisearch",
        });
      }
    }

    // 回退到 MySQL LIKE 搜索
    const keyword = `%${q}%`;

    // 搜索标题匹配
    const titleResults = (await query(
      `SELECT DISTINCT title FROM images
       WHERE title LIKE ? AND status = 'approved'
       ORDER BY download_count DESC
       LIMIT 5`,
      [keyword]
    )) as any[];

    // 搜索分类匹配
    const categoryResults = (await query(
      `SELECT DISTINCT category FROM images
       WHERE category LIKE ? AND status = 'approved' AND category != ''
       LIMIT 3`,
      [keyword]
    )) as any[];

    // 搜索标签匹配
    const tagResults = (await query(
      `SELECT DISTINCT tags FROM images
       WHERE tags LIKE ? AND status = 'approved' AND tags != ''
       LIMIT 5`,
      [keyword]
    )) as any[];

    // 提取标签
    const matchedTags = new Set<string>();
    tagResults.forEach((row: any) => {
      if (row.tags) {
        try {
          const parsed = JSON.parse(row.tags);
          if (Array.isArray(parsed)) {
            parsed.forEach((t: string) => {
              if (t.toLowerCase().includes(q.toLowerCase())) {
                matchedTags.add(t);
              }
            });
          }
        } catch {
          // tags 可能是逗号分隔的字符串
          row.tags.split(",").forEach((t: string) => {
            const trimmed = t.trim();
            if (trimmed.toLowerCase().includes(q.toLowerCase())) {
              matchedTags.add(trimmed);
            }
          });
        }
      }
    });

    const suggestions = [
      ...titleResults.map((r: any) => ({
        type: "title" as const,
        text: r.title,
      })),
      ...categoryResults
        .filter((r: any) => r.category)
        .map((r: any) => ({
          type: "category" as const,
          text: r.category,
        })),
      ...Array.from(matchedTags).slice(0, 3).map((t) => ({
        type: "tag" as const,
        text: t,
      })),
    ].slice(0, 8);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("GET /api/search/suggest error:", error);
    return NextResponse.json({ suggestions: [] });
  }
}