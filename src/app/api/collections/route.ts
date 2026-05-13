import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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

    let sql = `
      SELECT c.*, 
        u.name as author_name, u.avatar as author_avatar,
        i.url as cover_url, i.thumbnail_url as cover_thumbnail_url,
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN images i ON c.cover_image_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (userId) {
      sql += " AND c.user_id = ?";
      params.push(userId);
    }

    // 非Featured请求，只显示公开合集
    if (!featured) {
      sql += " AND c.is_public = TRUE";
    }

    // Featured请求按订阅数排序，否则按时间排序
    if (featured) {
      sql += " AND c.is_public = TRUE ORDER BY subscriber_count DESC, c.created_at DESC";
    } else {
      sql += " ORDER BY c.created_at DESC";
    }

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM collections c WHERE c.is_public = TRUE${userId ? " AND c.user_id = ?" : ""}`;
    const countResult = await query(countSql, userId ? [userId] : []);
    const total = (countResult as any[])[0]?.total || 0;

    sql += " LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = (await query(sql, params)) as any[];

    // 如果用户已登录，检查是否已订阅
    const session = await auth();
    if (session?.user) {
      const currentUserId = (session.user as any).id;
      const collectionIds = rows.map((r: any) => r.id);
      if (collectionIds.length > 0) {
        const subs = (await query(
          `SELECT collection_id FROM collection_subscriptions WHERE user_id = ? AND collection_id IN (?)`,
          [currentUserId, collectionIds.join(",")]
        )) as any[];
        const subscribedIds = new Set(subs.map((s: any) => s.collection_id));
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

    const result = (await query(
      `INSERT INTO collections (title, description, user_id, is_public, cover_image_id) VALUES (?, ?, ?, ?, ?)`,
      [title.trim(), description || null, userId, is_public ? 1 : 0, cover_image_id || null]
    )) as any;

    // 获取新创建的合集
    const newCollection = (await query(
      `SELECT c.*, u.name as author_name, u.avatar as author_avatar, 
        (SELECT COUNT(*) FROM collection_images WHERE collection_id = c.id) as image_count,
        (SELECT COUNT(*) FROM collection_subscriptions WHERE collection_id = c.id) as subscriber_count
      FROM collections c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
      [result.insertId]
    )) as any[];

    return NextResponse.json({ data: newCollection[0] }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/collections error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}