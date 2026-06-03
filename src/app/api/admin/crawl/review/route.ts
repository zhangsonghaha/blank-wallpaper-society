import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { indexImage, dbRowToSearchData } from "@/lib/meilisearch";

// GET /api/admin/crawl/review - 获取待审核的爬取图片
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build status condition
    const statusCondition = status === "pending"
      ? sql`AND i.status = 'pending'`
      : status === "approved"
        ? sql`AND i.status = 'approved'`
        : sql``;

    const rows = await sql<Record<string, any>>`SELECT i.* FROM images i
       WHERE i.description LIKE '%[crawl]%' ${statusCondition}
       ORDER BY i.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`.execute(db);

    const countResult = await sql<{ total: string | number }>`SELECT COUNT(*) as total FROM images i
       WHERE i.description LIKE '%[crawl]%' ${statusCondition}`.execute(db);

    return NextResponse.json({
      data: rows.rows,
      total: Number(countResult.rows[0]?.total || 0),
      page,
      totalPages: Math.ceil(Number(countResult.rows[0]?.total || 0) / limit),
    });
  } catch (error: any) {
    console.error("GET /api/admin/crawl/review error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/crawl/review - 批量审核爬取图片
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const adminId = (session.user as any).id;
    const body = await request.json();
    const { imageIds, action } = body;

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json({ error: "请选择要操作的图片" }, { status: 400 });
    }

    if (!action || !["approve", "reject", "delete"].includes(action)) {
      return NextResponse.json({ error: "无效的操作" }, { status: 400 });
    }

    const idValues = imageIds.map((id: number) => sql`${id}`);

    if (action === "approve") {
      await sql`UPDATE images SET status = 'approved', reviewed_by = ${adminId}, reviewed_at = NOW() WHERE id IN (${sql.join(idValues)}) AND status = 'pending'`.execute(db);

      // 同步搜索索引
      try {
        const approvedImages = await sql<Record<string, any>>`SELECT * FROM images WHERE id IN (${sql.join(idValues)}) AND status = 'approved'`.execute(db);
        for (const img of approvedImages.rows) {
          indexImage(dbRowToSearchData(img)).catch(() => {});
        }
      } catch {
        // 索引失败不影响主流程
      }
    } else if (action === "reject") {
      await sql`UPDATE images SET status = 'rejected', reviewed_by = ${adminId}, reviewed_at = NOW() WHERE id IN (${sql.join(idValues)})`.execute(db);
    } else if (action === "delete") {
      await db.deleteFrom("images")
        .where("id", "in", imageIds as number[])
        .execute();
    }

    return NextResponse.json({
      message: `批量${action === "approve" ? "审核通过" : action === "reject" ? "审核拒绝" : "删除"}成功`,
      count: imageIds.length,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/crawl/review error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
