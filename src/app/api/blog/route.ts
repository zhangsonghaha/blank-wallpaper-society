import { NextRequest, NextResponse } from "next/server";
import { db, safeExecute } from "@/lib/db";
import { sql } from "kysely";

// GET /api/blog - 获取博客文章列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    const category = searchParams.get("category");

    // Build dynamic WHERE conditions
    const conditions = [sql`p.status = 'published'`];
    const condValues: any[] = [];

    if (category) {
      conditions.push(sql`p.category = ${category}`);
    }

    const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=1`;

    // 获取文章列表
    const postsResult = await safeExecute(
      () => sql`
        SELECT p.id, p.title, p.content, p.excerpt, p.category, p.tags,
               p.author_id, u.name as author_name, u.image as author_avatar,
               p.created_at, p.updated_at,
               (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND post_type = 'blog') as comment_count
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `.execute(db),
      { rows: [] } as any,
      "blog-list"
    );
    const posts = (postsResult as any).rows;

    // 获取总数
    const countResult = await safeExecute(
      () => sql`SELECT COUNT(*) as total FROM posts p WHERE ${whereClause}`.execute(db),
      { rows: [{ total: 0 }] } as any,
      "blog-count"
    );
    const total = Number((countResult as any)?.rows?.[0]?.total ?? 0);

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
