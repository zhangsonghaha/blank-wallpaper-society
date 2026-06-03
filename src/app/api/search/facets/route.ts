import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeQueryParam } from "@/lib/sanitize";
import { sql } from "kysely";

// GET /api/search/facets - 搜索分面筛选（分类/颜色/分辨率聚合）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ? sanitizeQueryParam(searchParams.get("search")!) : null;
    const category = searchParams.get("category");

    // Build base conditions
    const conditions = [sql`status = 'approved'`];

    if (search) {
      const like = `%${search}%`;
      conditions.push(sql`(title LIKE ${like} OR description LIKE ${like} OR tags LIKE ${like})`);
    }
    if (category && category !== "all") {
      conditions.push(sql`category = ${category}`);
    }

    const whereClause = sql.join(conditions, sql` AND `);

    // 并行查询所有分面
    const [categoryRows, colorRows, resolutionRows] = await Promise.all([
      // 分类聚合
      sql`
        SELECT category, COUNT(*) as count FROM images
        WHERE ${whereClause} AND category IS NOT NULL AND category != ''
        GROUP BY category ORDER BY count DESC LIMIT 20
      `.execute(db),
      // 颜色聚合（取主色前12种色系）
      sql`
        SELECT dominant_color, COUNT(*) as count FROM images
        WHERE ${whereClause} AND dominant_color IS NOT NULL AND dominant_color != ''
        GROUP BY dominant_color ORDER BY count DESC LIMIT 50
      `.execute(db),
      // 分辨率聚合
      sql`
        SELECT
          CASE
            WHEN width >= 3840 THEN '4K+'
            WHEN width >= 2560 THEN '2K+'
            WHEN width >= 1920 THEN '1080p+'
            WHEN width >= 1280 THEN '720p+'
            ELSE 'SD'
          END as resolution_tier,
          COUNT(*) as count
        FROM images WHERE ${whereClause} AND width IS NOT NULL AND width > 0
        GROUP BY resolution_tier
        ORDER BY MIN(width) DESC
      `.execute(db),
    ]);

    // 将颜色聚合成色系（简化为16色系）
    const colorBuckets: Record<string, { hex: string; count: number }> = {};
    const colorNameMap: Record<string, string> = {
      red: "红色", orange: "橙色", yellow: "黄色", green: "绿色",
      cyan: "青色", blue: "蓝色", purple: "紫色", pink: "粉色",
      brown: "棕色", black: "黑色", gray: "灰色", white: "白色",
    };

    function classifyColor(hex: string): string {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2 / 255;
      const s = max === min ? 0 : (max - min) / (l > 0.5 ? (510 - max - min) : (max + min));

      if (l < 0.15) return "black";
      if (l > 0.85 && s < 0.15) return "white";
      if (s < 0.12) return "gray";

      const h = (() => {
        const d = max - min;
        if (d === 0) return 0;
        if (max === r) return ((g - b) / d + (g < b ? 6 : 0)) * 60;
        if (max === g) return ((b - r) / d + 2) * 60;
        return ((r - g) / d + 4) * 60;
      })();

      if (h < 15 || h >= 345) return "red";
      if (h < 45) return "orange";
      if (h < 70) return "yellow";
      if (h < 165) return "green";
      if (h < 195) return "cyan";
      if (h < 260) return "blue";
      if (h < 290) return "purple";
      if (h < 345) return "pink";
      return "red";
    }

    for (const row of colorRows.rows as any[]) {
      const hex = row.dominant_color;
      if (!hex || hex.length < 7) continue;
      const colorFamily = classifyColor(hex);
      if (!colorBuckets[colorFamily]) {
        colorBuckets[colorFamily] = { hex, count: 0 };
      }
      colorBuckets[colorFamily].count += Number(row.count);
      // 保留更鲜艳的代表色
      if (hex !== colorBuckets[colorFamily].hex) {
        const curR = parseInt(colorBuckets[colorFamily].hex.slice(1, 3), 16);
        const curG = parseInt(colorBuckets[colorFamily].hex.slice(3, 5), 16);
        const curB = parseInt(colorBuckets[colorFamily].hex.slice(5, 7), 16);
        const curMax = Math.max(curR, curG, curB);
        const curMin = Math.min(curR, curG, curB);
        const curSat = curMax === 0 ? 0 : (curMax - curMin) / curMax;

        const newR = parseInt(hex.slice(1, 3), 16);
        const newG = parseInt(hex.slice(3, 5), 16);
        const newB = parseInt(hex.slice(5, 7), 16);
        const newMax = Math.max(newR, newG, newB);
        const newMin = Math.min(newR, newG, newB);
        const newSat = newMax === 0 ? 0 : (newMax - newMin) / newMax;

        if (newSat > curSat) {
          colorBuckets[colorFamily].hex = hex;
        }
      }
    }

    const facets = {
      categories: (categoryRows.rows as any[]).map((r) => ({
        name: r.category,
        count: Number(r.count),
      })),
      colors: Object.entries(colorBuckets)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 12)
        .map(([name, data]) => ({
          name: colorNameMap[name] || name,
          hex: data.hex,
          family: name,
          count: data.count,
        })),
      resolutions: (resolutionRows.rows as any[]).map((r) => ({
        name: r.resolution_tier,
        count: Number(r.count),
      })),
    };

    return NextResponse.json({ facets });
  } catch (error: any) {
    console.error("GET /api/search/facets error:", error);
    return NextResponse.json({ facets: { categories: [], colors: [], resolutions: [] } });
  }
}
