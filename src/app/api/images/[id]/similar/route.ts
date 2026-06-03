import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

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
    const current = await db
      .selectFrom("images")
      .where("id", "=", imageId)
      .where("status", "=", "approved")
      .select(["category", "dominant_color", "tags"])
      .executeTakeFirst();

    if (!current) {
      return NextResponse.json({ data: [] });
    }

    // 构建查询条件（使用 sql template for dynamic OR conditions）
    const conditions: any[] = [];

    // 同分类（优先）
    if (current.category) {
      conditions.push(sql`(category = ${current.category} AND id != ${imageId})`);
    }

    // 同主色调（次优）
    if (current.dominant_color) {
      if (current.category) {
        conditions.push(sql`(dominant_color = ${current.dominant_color} AND category != ${current.category} AND id != ${imageId})`);
      } else {
        conditions.push(sql`(dominant_color = ${current.dominant_color} AND id != ${imageId})`);
      }
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
        const tagLikeConditions = tagList.map((tag: string) => sql`tags LIKE ${`%${tag}%`}`);
        conditions.push(sql`((${sql.join(tagLikeConditions, sql` OR `)}) AND id != ${imageId})`);
      }
    }

    let similar: any[] = [];

    if (conditions.length > 0) {
      const orCondition = sql.join(conditions, sql` OR `);
      const result1 = await sql<{
        id: number;
        title: string;
        url: string | null;
        thumbnail_url: string | null;
        width: number | null;
        height: number | null;
        author: string | null;
        category: string | null;
        dominant_color: string | null;
        tags: string | null;
        uploaded_by: number | null;
      }>`SELECT id, title, url, thumbnail_url, width, height, author, category, dominant_color, tags, uploaded_by
         FROM images
         WHERE (${orCondition}) AND status = 'approved' AND url IS NOT NULL AND url != ''
         ORDER BY 
           CASE WHEN category = ${current.category || ''} THEN 1 ELSE 2 END,
           CASE WHEN dominant_color = ${current.dominant_color || ''} THEN 1 ELSE 2 END,
           RAND()
         LIMIT 12`.execute(db);
      similar = result1.rows;
    }

    // 如果结果不足，补充随机推荐
    if (similar.length < 6) {
      const existingIds = similar.map((s) => s.id);
      existingIds.push(imageId);

      const result2 = await sql<{
        id: number;
        title: string;
        url: string | null;
        thumbnail_url: string | null;
        width: number | null;
        height: number | null;
        author: string | null;
        category: string | null;
        dominant_color: string | null;
        tags: string | null;
        uploaded_by: number | null;
      }>`SELECT id, title, url, thumbnail_url, width, height, author, category, dominant_color, tags, uploaded_by
         FROM images
         WHERE id NOT IN (${sql.join(existingIds)}) AND status = 'approved' AND url IS NOT NULL AND url != ''
         ORDER BY RAND()
         LIMIT ${12 - similar.length}`.execute(db);

      similar = [...similar, ...result2.rows];
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
          } catch { currentTags = current.tags!.split(','); }
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
