import { NextRequest, NextResponse } from "next/server";
import { query, safeQuery } from "@/lib/db";

// GET /api/blog - 获取博客文章列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    const category = searchParams.get("category");

    let where = "WHERE status = 'published'";
    const values: string[] = [];

    if (category) {
      where += " AND category = ?";
      values.push(category);
    }

    // 获取文章列表
    const posts = (await safeQuery(
      `SELECT p.id, p.title, p.content, p.excerpt, p.category, p.tags,
              p.author_id, u.name as author_name, u.image as author_avatar,
              p.created_at, p.updated_at,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND post_type = 'blog') as comment_count
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
      []
    )) as any[];

    // 获取总数
    const countResult = (await safeQuery(
      `SELECT COUNT(*) as total FROM posts ${where}`,
      values,
      [{ total: 0 }]
    )) as any[];

    const total = Number(countResult?.[0]?.total ?? 0);

    // 如果数据库无文章，返回空列表（前端可显示默认内容）
    return NextResponse.json({
      posts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error("GET /api/blog error:", error);
    return NextResponse.json({ posts: [], total: 0, page: 1, limit: 10, totalPages: 1 });
  }
}