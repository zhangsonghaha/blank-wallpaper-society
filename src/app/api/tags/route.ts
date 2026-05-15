import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/tags - 获取标签列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "popular"; // popular | all | cloud

    if (type === "cloud" || type === "popular") {
      // 从 images 表中提取标签，统计使用次数
      const tagStats = (await query(
        `SELECT tags FROM images WHERE tags IS NOT NULL AND tags != '' AND status = 'approved'`
      )) as any[];

      // 解析并统计标签
      const tagMap = new Map<string, number>();
      tagStats.forEach((row: any) => {
        if (row.tags) {
          try {
            const parsed = JSON.parse(row.tags);
            if (Array.isArray(parsed)) {
              // 去重每个图片内的标签
              const unique = [...new Set(parsed.map((t: string) => t.trim().toLowerCase()).filter(Boolean))];
              unique.forEach((t) => {
                tagMap.set(t, (tagMap.get(t) || 0) + 1);
              });
            }
          } catch {
            row.tags.split(",").forEach((t: string) => {
              const trimmed = t.trim().toLowerCase();
              if (trimmed) {
                tagMap.set(trimmed, (tagMap.get(trimmed) || 0) + 1);
              }
            });
          }
        }
      });

      // 转为数组并排序
      const tags = Array.from(tagMap.entries())
        .map(([name, count]) => ({
          name,
          slug: name.replace(/\s+/g, "-"),
          count,
          size: 1,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, type === "popular" ? 30 : 200);

      // 为标签云计算大小
      if (type === "cloud") {
        const maxCount = tags[0]?.count || 1;
        const minCount = tags[tags.length - 1]?.count || 1;
        const range = Math.max(maxCount - minCount, 1);

        tags.forEach((tag) => {
          const normalized = (tag.count - minCount) / range;
          tag.size = Math.round(normalized * 4 + 1); // 1-5 级
        });
      }

      return NextResponse.json({ data: tags });
    }

    // 从 tags 表获取（如果已同步）
    const tags = (await query(
      "SELECT * FROM tags ORDER BY image_count DESC LIMIT 100"
    )) as any[];

    return NextResponse.json({ data: tags });
  } catch (error: any) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json(
      { error: error.message || "获取标签失败" },
      { status: 500 }
    );
  }
}