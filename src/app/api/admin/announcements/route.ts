import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET - 获取通知公告列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const type = searchParams.get("type");
    const is_published = searchParams.get("is_published");

    const whereParts: ReturnType<typeof sql>[] = [];
    if (type) whereParts.push(sql`type = ${type}`);
    if (is_published !== null && is_published !== undefined && is_published !== '') {
      whereParts.push(sql`is_published = ${Number(is_published)}`);
    }

    const whereClause = whereParts.length > 0
      ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
      : sql``;

    // 获取总数
    const countResult = await sql<{ total: string | number }>`SELECT COUNT(*) as total FROM sys_announcements ${whereClause}`.execute(db);

    // 获取列表
    const offset = (page - 1) * pageSize;
    const list = await sql<{
      id: number; title: string; content: string; type: string; priority: string;
      is_published: number; start_time: string; end_time: string; author_id: number;
      created_at: string; updated_at: string; author_name: string;
    }>`SELECT a.*, u.name as author_name FROM sys_announcements a LEFT JOIN users u ON a.author_id = u.id ${whereClause} ORDER BY a.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`.execute(db);

    return NextResponse.json({
      success: true,
      data: list.rows,
      total: Number(countResult.rows[0]?.total || 0),
      page,
      pageSize,
    });
  } catch (error) {
    console.error("获取通知公告列表失败:", error);
    return NextResponse.json({ success: false, error: "获取通知公告列表失败" }, { status: 500 });
  }
}

// POST - 新增通知公告
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, type, priority, is_published, start_time, end_time, author_id } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, error: "标题和内容不能为空" }, { status: 400 });
    }

    const result = await db.insertInto("sys_announcements")
      .values({
        title,
        content,
        type: type || 'notice',
        priority: priority || 'normal',
        is_published: is_published ?? 0,
        start_time: start_time || null,
        end_time: end_time || null,
        author_id: author_id || null,
      })
      .executeTakeFirst();

    return NextResponse.json({ success: true, data: { id: Number(result.insertId), ...body } });
  } catch (error) {
    console.error("新增通知公告失败:", error);
    return NextResponse.json({ success: false, error: "新增通知公告失败" }, { status: 500 });
  }
}

// PUT - 更新通知公告
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, content, type, priority, is_published, start_time, end_time } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "公告ID不能为空" }, { status: 400 });
    }

    await db.updateTable("sys_announcements")
      .set({
        title,
        content,
        type: type || 'notice',
        priority: priority || 'normal',
        is_published: is_published ?? 0,
        start_time: start_time || null,
        end_time: end_time || null,
      })
      .where("id", "=", id)
      .execute();

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error("更新通知公告失败:", error);
    return NextResponse.json({ success: false, error: "更新通知公告失败" }, { status: 500 });
  }
}

// DELETE - 删除通知公告
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "公告ID不能为空" }, { status: 400 });
    }

    await db.deleteFrom("sys_announcements").where("id", "=", Number(id)).execute();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除通知公告失败:", error);
    return NextResponse.json({ success: false, error: "删除通知公告失败" }, { status: 500 });
  }
}
