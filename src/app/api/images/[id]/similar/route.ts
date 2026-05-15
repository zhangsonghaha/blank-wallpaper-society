import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/images/[id]/similar - 获取相似图片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = parseInt(id);

    if (isNaN(imageId)) {
      return NextResponse.json({ error: "无效的图片ID" }, { status: 400 });
    }

    // 先获取当前图片的分类和颜色
    const images = (await query(
      "SELECT category, dominant_color, tags FROM images WHERE id = ? AND status = 'approved'",
      [imageId]
    )) as any[];

    if (images.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const current = images[0];

    // 构建查询条件
    const conditions: string[] = [];
    const paramsList: any[] = [];

    // 同分类（优先）
    if (current.category) {
      conditions.push("(category = ? AND id != ?)");
      paramsList.push(current.category, imageId);
    }

    // 同主色调（次优）
    if (current.dominant_color) {
      const catCond = current.category ? " AND category != ?" : "";
      conditions.push(`(dominant_color = ?${catCond} AND id != ?)`);
      paramsList.push(current.dominant_color);
      if (current.category) paramsList.push(current.category);
      paramsList.push(imageId);
    }

    let similar: any[] = [];

    if (conditions.length > 0) {
      const whereClause = conditions.join(" OR ");
      similar = (await query(
        `SELECT id, title, url, thumbnail_url, width, height, author, category, dominant_color, tags, uploaded_by
         FROM images
         WHERE (${whereClause}) AND status = 'approved'
         ORDER BY RAND()
         LIMIT 12`,
        paramsList
      )) as any[];
    }

    // 如果结果不足，补充随机推荐
    if (similar.length < 6) {
      const existingIds = similar.map((s) => s.id);
      existingIds.push(imageId);
      const placeholders = existingIds.map(() => "?").join(",");

      const extra = (await query(
        `SELECT id, title, url, thumbnail_url, width, height, author, category, dominant_color, tags, uploaded_by
         FROM images
         WHERE id NOT IN (${placeholders}) AND status = 'approved'
         ORDER BY RAND()
         LIMIT ?`,
        [...existingIds, 12 - similar.length]
      )) as any[];

      similar = [...similar, ...extra];
    }

    // 处理返回数据：确保 URL 有效
    const data = similar.slice(0, 12).map((img) => ({
      id: img.id,
      title: img.title,
      author: img.author,
      category: img.category,
      width: img.width,
      height: img.height,
      uploaded_by: img.uploaded_by,
      // 始终提供可用的图片 URL
      thumbnail_url: img.thumbnail_url || null,
      url: img.url || null,
      // 生成代理 URL 用于前端显示
      display_url: img.thumbnail_url
        ? `/api/proxy-image?url=${encodeURIComponent(img.thumbnail_url)}`
        : img.url
          ? `/api/proxy-image?url=${encodeURIComponent(img.url)}`
          : null,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("GET /api/images/[id]/similar error:", error);
    return NextResponse.json(
      { error: error.message || "获取相似图片失败" },
      { status: 500 }
    );
  }
}