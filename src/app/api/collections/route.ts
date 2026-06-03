import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";

// GET /api/collections - 获取合集列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;
    const userId = searchParams.get("userId");
    const featured = searchParams.get("featured") === "true";

    // 构建动态 WHERE 条件
    const whereParts: ReturnType<typeof sql>[] = [sql`c.is_public = TRUE`];

    if (userId) {
      whereParts.push(sql`c.user_id = ${userId}`);
    }

    const whereClause = sql`WHERE ${sql.join(whereParts, sql` AND `)}`;

    // Featured请求按订阅数排序，否则按时间排序
    const orderClause = featured
      ? sql`ORDER BY subscriber_count DESC, c.created_at DESC`
      : sql`ORDER BY c.created_at DESC`;

    // 获取总数
    const countWhereParts: ReturnType<typeof sql>[] = [sql`c.is_public = TRUE`];
    if (userId) {
      countWhereParts.push(sql`c.user_id = ${userId}`);
    }
    const countWhereClause = sql`WHERE ${sql.join(countWhereParts, sql` AND `)}`;

    const countResult = await sql<{ total: string | number }>`
      SELECT COUNT(*) as total FROM collections c ${countWhereClause}
    `.execute(db);
    const total = Number(countResult.rows[0]?.total ?? 0);

    // 主查询：含 LEFT JOIN 和关联子查询
    const rowsResult = await sql<Record<string, any>>`
      SELECT c.*, 
        u.name as author_name, u.avatar as author_avatar,
        i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN images i ON c.cover_image_id = i.id
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `.execute(db);
    const rows = rowsResult.rows as any[];

    // 如果用户已登录，检查是否已订阅
    const session = await auth();
    if (session?.user) {
      const currentUserId = (session.user as any).id;
      const collectionIds = rows.map((r: any) => r.id);
      if (collectionIds.length > 0) {
        const subsResult = await db
          .selectFrom("collection_subscriptions")
          .select(["collection_id"])
          .where("user_id", "=", currentUserId)
          .where("collection_id", "in", collectionIds)
          .execute();
        const subscribedIds = new Set(subsResult.map((s) => s.collection_id));
        rows.forEach((r: any) => {
          r.is_subscribed = subscribedIds.has(r.id);
        });
      }
    }

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("GET /api/collections error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/collections - 创建合集
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { title, description, is_public = true, cover_image_id } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "合集标题不能为空" }, { status: 400 });
    }

    const insertResult = await db
      .insertInto("collections")
      .values({
        title: title.trim(),
        description: description || null,
        user_id: userId,
        is_public: is_public ? 1 : 0,
        cover_image_id: cover_image_id || null,
      })
      .executeTakeFirst();

    const newId = Number(insertResult.insertId);

    // 获取新创建的合集
    const newCollection = await sql<Record<string, any>>`
      SELECT c.*, u.name as author_name, u.avatar as author_avatar, 
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ${newId}
    `.execute(db);

    return NextResponse.json({ data: newCollection.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/collections error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
