import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
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
      const latestSessions = await db.selectFrom("crawl_sessions")
        .where("status", "=", "pending")
        .select(["id"])
        .orderBy("created_at", "desc")
        .limit(1)
        .execute();
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

    const sessionRows = await db.selectFrom("crawl_sessions")
      .where("id", "=", targetSessionId)
      .select(["id", "source_url", "source_type", "category", "tags", "total_count", "selected_count", "imported_count", "status", "created_at"])
      .execute();

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const [items, countResult] = await Promise.all([
      db.selectFrom("crawl_preview_items")
        .where("session_id", "=", targetSessionId)
        .select(["id", "session_id", "source_url", "title", "width", "height", "file_size", "mime_type", "media_type", "is_selected", "source", "tags", "category", "video_url", "poster_url", "created_at"])
        .orderBy("id", "asc")
        .limit(pageSize)
        .offset(offset)
        .execute(),
      db.selectFrom("crawl_preview_items")
        .where("session_id", "=", targetSessionId)
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ]);

    const total = Number(countResult?.total || 0);

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
      await db.updateTable("crawl_preview_items")
        .set({ is_selected: select_all ? 1 : 0 })
        .where("session_id", "=", session_id)
        .execute();
      const countResult = await db.selectFrom("crawl_preview_items")
        .where("session_id", "=", session_id)
        .where("is_selected", "=", 1)
        .select((eb) => eb.fn.countAll().as("cnt"))
        .executeTakeFirst();
      const selectedCount = Number(countResult?.cnt || 0);
      await db.updateTable("crawl_sessions")
        .set({ selected_count: selectedCount })
        .where("id", "=", session_id)
        .execute();
      return NextResponse.json({ message: select_all ? "已全选" : "已取消全选", selected_count: selectedCount });
    }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: "请提供 item_ids" }, { status: 400 });
    }

    await db.updateTable("crawl_preview_items")
      .set({ is_selected: selected ? 1 : 0 })
      .where("id", "in", item_ids as number[])
      .where("session_id", "=", session_id)
      .execute();

    // 更新 session 的 selected_count
    const countResult = await db.selectFrom("crawl_preview_items")
      .where("session_id", "=", session_id)
      .where("is_selected", "=", 1)
      .select((eb) => eb.fn.countAll().as("cnt"))
      .executeTakeFirst();
    const selectedCount = Number(countResult?.cnt || 0);
    await db.updateTable("crawl_sessions")
      .set({ selected_count: selectedCount })
      .where("id", "=", session_id)
      .execute();

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

    // 级联删除
    await db.deleteFrom("crawl_preview_items").where("session_id", "=", sessionId).execute();
    await db.updateTable("crawl_sessions").set({ status: "discarded" }).where("id", "=", sessionId).execute();

    return NextResponse.json({ message: "会话已丢弃" });
  } catch (error: any) {
    console.error("DELETE /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
