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

    // 同标签（第三优先级）
    if (current.tags && current.tags.trim()) {
      let tagList: string[] = [];
      // 兼容两种标签格式：JSON数组 ["tag1","tag2"] 和逗号分隔 "tag1,tag2"
      try {
        const parsed = JSON.parse(current.tags);
        if (Array.isArray(parsed)) {
          tagList = parsed.map((t: string) => String(t).trim()).filter(Boolean);
        }
      } catch {
        tagList = current.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
      // 只取前5个标签，避免查询过于宽泛
      tagList = tagList.slice(0, 5);
      if (tagList.length > 0) {
        const tagConditions = tagList.map(() => "tags LIKE ?").join(" OR ");
        conditions.push(`((${tagConditions}) AND id != ?)`);
        tagList.forEach((tag: string) => paramsList.push(`%${tag}%`));
        paramsList.push(imageId);
      }
    }

    let similar: any[] = [];

    if (conditions.length > 0) {
      const whereClause = conditions.join(" OR ");
      similar = (await query(
        `SELECT id, title, url, thumbnail_url, width, height, author, category, dominant_color, tags, uploaded_by
         FROM images
         WHERE (${whereClause}) AND status = 'approved' AND url IS NOT NULL AND url != ''
         ORDER BY 
           CASE WHEN category = ? THEN 1 ELSE 2 END,
           CASE WHEN dominant_color = ? THEN 1 ELSE 2 END,
           RAND()
         LIMIT 12`,
        [...paramsList, current.category || '', current.dominant_color || '']
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
         WHERE id NOT IN (${placeholders}) AND status = 'approved' AND url IS NOT NULL AND url != ''
         ORDER BY RAND()
         LIMIT ?`,
        [...existingIds, 12 - similar.length]
      )) as any[];

      similar = [...similar, ...extra];
    }

    // 处理返回数据：确保 URL 有效，并标记匹配类型
    const data = similar.slice(0, 12).map((img) => {
      let match_type = "random";
      if (img.category && current.category && img.category === current.category) {
        match_type = "same_category";
      } else if (img.dominant_color && current.dominant_color && img.dominant_color === current.dominant_color) {
        match_type = "same_color";
      } else {
        // 检查标签是否有重叠
        if (current.tags && img.tags) {
          let currentTags: string[] = [];
          let imgTags: string[] = [];
          try {
            currentTags = JSON.parse(current.tags);
            if (!Array.isArray(currentTags)) currentTags = [currentTags];
          } catch { currentTags = current.tags.split(','); }
          try {
            imgTags = JSON.parse(img.tags);
            if (!Array.isArray(imgTags)) imgTags = [imgTags];
          } catch { imgTags = img.tags.split(','); }
          const overlap = currentTags.some(t => imgTags.includes(t));
          if (overlap) match_type = "same_tag";
        }
      }

      return {
        id: img.id,
        title: img.title,
        author: img.author,
        category: img.category,
        width: img.width,
        height: img.height,
        uploaded_by: img.uploaded_by,
        thumbnail_url: img.thumbnail_url || null,
        url: img.url || null,
        match_type,
        // 生成代理 URL 用于前端显示
        display_url: img.thumbnail_url
          ? `/api/proxy-image?url=${encodeURIComponent(img.thumbnail_url)}`
          : img.url
            ? `/api/proxy-image?url=${encodeURIComponent(img.url)}`
            : null,
      };
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("GET /api/images/[id]/similar error:", error);
    return NextResponse.json(
      { error: error.message || "获取相似图片失败" },
      { status: 500 }
    );
  }
}