import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET - 获取通知公告列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const type = searchParams.get("type");
    const is_published = searchParams.get("is_published");

    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (type) {
      whereClause += " AND type = ?";
      params.push(type);
    }
    if (is_published !== null && is_published !== undefined && is_published !== '') {
      whereClause += " AND is_published = ?";
      params.push(Number(is_published));
    }

    // 获取总数
    const countResult = await query(
      `SELECT COUNT(*) as total FROM sys_announcements ${whereClause}`,
      params
    ) as any[];

    // 获取列表
    const offset = (page - 1) * pageSize;
    const list = await query(
      `SELECT a.*, u.name as author_name FROM sys_announcements a LEFT JOIN users u ON a.author_id = u.id ${whereClause} ORDER BY a.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    ) as any[];

    return NextResponse.json({
      success: true,
      data: list,
      total: countResult[0]?.total || 0,
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

    const result = await query(
      `INSERT INTO sys_announcements (title, content, type, priority, is_published, start_time, end_time, author_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, content, type || 'notice', priority || 'normal', is_published ?? 0, start_time || null, end_time || null, author_id || null]
    ) as any;

    return NextResponse.json({ success: true, data: { id: result.insertId, ...body } });
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

    await query(
      `UPDATE sys_announcements SET title=?, content=?, type=?, priority=?, is_published=?, start_time=?, end_time=? WHERE id=?`,
      [title, content, type || 'notice', priority || 'normal', is_published ?? 0, start_time || null, end_time || null, id]
    );

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

    await query("DELETE FROM sys_announcements WHERE id = ?", [Number(id)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除通知公告失败:", error);
    return NextResponse.json({ success: false, error: "删除通知公告失败" }, { status: 500 });
  }
}