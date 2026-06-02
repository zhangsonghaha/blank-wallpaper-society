import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/crawl/preview — 获取会话信息 + 分页预览项
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    let targetSessionId = sessionId ? parseInt(sessionId) : null;

    // 未指定 session_id 时，自动获取最近一个 pending 会话
    if (!targetSessionId) {
      const latestSessions = await query(
        `SELECT id FROM crawl_sessions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1`
      ) as any[];
      if (latestSessions.length > 0) {
        targetSessionId = latestSessions[0].id;
      }
    }

    if (!targetSessionId) {
      return NextResponse.json({
        session: null,
        items: [],
        pagination: { page: 1, pageSize, total: 0 },
      });
    }

    const sessionRows = await query(
      `SELECT id, source_url, source_type, category, tags, total_count, selected_count, imported_count, status, created_at
       FROM crawl_sessions WHERE id = ?`,
      [targetSessionId]
    ) as any[];

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const [items, countResult] = await Promise.all([
      query(
        `SELECT id, session_id, source_url, title, width, height, file_size, mime_type, media_type, is_selected, source, tags, category, video_url, poster_url, created_at
         FROM crawl_preview_items
         WHERE session_id = ?
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [targetSessionId, pageSize, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM crawl_preview_items WHERE session_id = ?`,
        [targetSessionId]
      ),
    ]);

    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({
      session: sessionRows[0],
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error("GET /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/crawl/preview — 批量选中/取消选中
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { session_id, item_ids, selected, select_all } = body;

    if (!session_id) {
      return NextResponse.json({ error: "请提供 session_id" }, { status: 400 });
    }

    if (select_all !== undefined) {
      // 全选/取消全选
      await query(
        `UPDATE crawl_preview_items SET is_selected = ? WHERE session_id = ?`,
        [select_all ? 1 : 0, session_id]
      );
      const countResult = await query(
        `SELECT COUNT(*) as cnt FROM crawl_preview_items WHERE session_id = ? AND is_selected = 1`,
        [session_id]
      ) as any[];
      const selectedCount = (countResult[0] as any)?.cnt || 0;
      await query(
        `UPDATE crawl_sessions SET selected_count = ? WHERE id = ?`,
        [selectedCount, session_id]
      );
      return NextResponse.json({ message: select_all ? "已全选" : "已取消全选", selected_count: selectedCount });
    }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: "请提供 item_ids" }, { status: 400 });
    }

    const placeholders = item_ids.map(() => "?").join(",");
    await query(
      `UPDATE crawl_preview_items SET is_selected = ? WHERE id IN (${placeholders}) AND session_id = ?`,
      [selected ? 1 : 0, ...item_ids, session_id]
    );

    // 更新 session 的 selected_count
    const countResult = await query(
      `SELECT COUNT(*) as cnt FROM crawl_preview_items WHERE session_id = ? AND is_selected = 1`,
      [session_id]
    ) as any[];
    const selectedCount = (countResult[0] as any)?.cnt || 0;
    await query(
      `UPDATE crawl_sessions SET selected_count = ? WHERE id = ?`,
      [selectedCount, session_id]
    );

    return NextResponse.json({
      message: selected ? "已选中" : "已取消选中",
      selected_count: selectedCount,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/crawl/preview — 丢弃会话（级联删除预览项）
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = parseInt(searchParams.get("session_id") || "0");

    if (!sessionId) {
      return NextResponse.json({ error: "请提供 session_id" }, { status: 400 });
    }

    // 级联删除（外键ON DELETE CASCADE 自动删除 items）
    await query(`DELETE FROM crawl_preview_items WHERE session_id = ?`, [sessionId]);
    await query(`UPDATE crawl_sessions SET status = 'discarded' WHERE id = ?`, [sessionId]);

    return NextResponse.json({ message: "会话已丢弃" });
  } catch (error: any) {
    console.error("DELETE /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
