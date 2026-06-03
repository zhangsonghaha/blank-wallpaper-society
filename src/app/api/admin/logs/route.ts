import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";

// GET /api/admin/logs - 获取各类日志
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "admin_operation";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    switch (type) {
      case "admin_operation":
        return await getAdminOperationLogs(searchParams, page, pageSize, offset);
      case "download":
        return await getDownloadLogs(searchParams, page, pageSize, offset);
      case "view":
        return await getViewLogs(searchParams, page, pageSize, offset);
      case "account_deletion":
        return await getAccountDeletionLogs(searchParams, page, pageSize, offset);
      case "overview":
        return await getLogsOverview();
      default:
        return NextResponse.json({ error: "未知日志类型" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("GET /api/admin/logs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 日志概览统计
async function getLogsOverview() {
  const [adminOps, downloads, views, accountDeletions, recentOps] = await Promise.all([
    db.selectFrom("admin_operation_logs").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    db.selectFrom("download_logs").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    db.selectFrom("view_logs").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    db.selectFrom("account_deletion_logs").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    sql<{ date: string; count: string | number }>`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM admin_operation_logs
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) ORDER BY date`.execute(db),
  ]);

  // 今日统计
  const [todayDownloads, todayViews, todayOps] = await Promise.all([
    db.selectFrom("download_logs").where("created_at", ">=", sql<Date>`CURDATE()`).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    db.selectFrom("view_logs").where("created_at", ">=", sql<Date>`CURDATE()`).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    db.selectFrom("admin_operation_logs").where("created_at", ">=", sql<Date>`CURDATE()`).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
  ]);

  // 下载量趋势（7天）
  const downloadTrend = await sql<{ date: string; count: string | number }>`SELECT DATE(created_at) as date, COUNT(*) as count
     FROM download_logs
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at) ORDER BY date`.execute(db);

  // 浏览量趋势（7天）
  const viewTrend = await sql<{ date: string; count: string | number }>`SELECT DATE(created_at) as date, COUNT(*) as count
     FROM view_logs
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at) ORDER BY date`.execute(db);

  // 操作类型分布
  const opDistribution = await db.selectFrom("admin_operation_logs")
    .select((eb) => ["operation", eb.fn.countAll().as("count")])
    .groupBy("operation")
    .orderBy("count", "desc")
    .limit(20)
    .execute();

  return NextResponse.json({
    data: {
      totalAdminOps: Number(adminOps?.count || 0),
      totalDownloads: Number(downloads?.count || 0),
      totalViews: Number(views?.count || 0),
      totalAccountDeletions: Number(accountDeletions?.count || 0),
      todayDownloads: Number(todayDownloads?.count || 0),
      todayViews: Number(todayViews?.count || 0),
      todayOps: Number(todayOps?.count || 0),
      opsTrend: recentOps.rows,
      downloadTrend: downloadTrend.rows,
      viewTrend: viewTrend.rows,
      opDistribution,
    },
  });
}

// 管理员操作日志
async function getAdminOperationLogs(
  searchParams: URLSearchParams,
  page: number,
  pageSize: number,
  offset: number
) {
  const operation = searchParams.get("operation");
  const operatorId = searchParams.get("operatorId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const whereParts: ReturnType<typeof sql>[] = [];

  if (operation) whereParts.push(sql`a.operation = ${operation}`);
  if (operatorId) whereParts.push(sql`a.operator_id = ${parseInt(operatorId)}`);
  if (startDate) whereParts.push(sql`a.created_at >= ${startDate}`);
  if (endDate) whereParts.push(sql`a.created_at <= ${endDate + " 23:59:59"}`);

  const whereClause = whereParts.length > 0
    ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    : sql``;

  const countResult = await sql<{ total: string | number }>`SELECT COUNT(*) as total FROM admin_operation_logs a ${whereClause}`.execute(db);
  const total = Number(countResult.rows[0]?.total ?? 0);

  const logs = await sql<Record<string, any>>`SELECT a.*, u.name as operator_name, ut.name as target_user_name
     FROM admin_operation_logs a
     LEFT JOIN users u ON a.operator_id = u.id
     LEFT JOIN users ut ON a.target_user_id = ut.id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`.execute(db);

  // 操作类型列表（用于筛选下拉）
  const operations = await sql<{ operation: string }>`SELECT DISTINCT operation FROM admin_operation_logs ORDER BY operation`.execute(db);

  return NextResponse.json({
    data: { logs: logs.rows, total, operations: operations.rows },
    page,
    pageSize,
  });
}

// 下载日志
async function getDownloadLogs(
  searchParams: URLSearchParams,
  page: number,
  pageSize: number,
  offset: number
) {
  const imageId = searchParams.get("imageId");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const whereParts: ReturnType<typeof sql>[] = [];

  if (imageId) whereParts.push(sql`d.image_id = ${parseInt(imageId)}`);
  if (userId) whereParts.push(sql`d.user_id = ${parseInt(userId)}`);
  if (startDate) whereParts.push(sql`d.created_at >= ${startDate}`);
  if (endDate) whereParts.push(sql`d.created_at <= ${endDate + " 23:59:59"}`);

  const whereClause = whereParts.length > 0
    ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    : sql``;

  const countResult = await sql<{ total: string | number }>`SELECT COUNT(*) as total FROM download_logs d ${whereClause}`.execute(db);
  const total = Number(countResult.rows[0]?.total ?? 0);

  const logs = await sql<Record<string, any>>`SELECT d.*, i.title as image_title, u.name as user_name
     FROM download_logs d
     LEFT JOIN images i ON d.image_id = i.id
     LEFT JOIN users u ON d.user_id = u.id
     ${whereClause}
     ORDER BY d.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`.execute(db);

  return NextResponse.json({
    data: { logs: logs.rows, total },
    page,
    pageSize,
  });
}

// 浏览日志
async function getViewLogs(
  searchParams: URLSearchParams,
  page: number,
  pageSize: number,
  offset: number
) {
  const imageId = searchParams.get("imageId");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const whereParts: ReturnType<typeof sql>[] = [];

  if (imageId) whereParts.push(sql`v.image_id = ${parseInt(imageId)}`);
  if (userId) whereParts.push(sql`v.user_id = ${parseInt(userId)}`);
  if (startDate) whereParts.push(sql`v.created_at >= ${startDate}`);
  if (endDate) whereParts.push(sql`v.created_at <= ${endDate + " 23:59:59"}`);

  const whereClause = whereParts.length > 0
    ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    : sql``;

  const countResult = await sql<{ total: string | number }>`SELECT COUNT(*) as total FROM view_logs v ${whereClause}`.execute(db);
  const total = Number(countResult.rows[0]?.total ?? 0);

  const logs = await sql<Record<string, any>>`SELECT v.*, i.title as image_title, u.name as user_name
     FROM view_logs v
     LEFT JOIN images i ON v.image_id = i.id
     LEFT JOIN users u ON v.user_id = u.id
     ${whereClause}
     ORDER BY v.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`.execute(db);

  return NextResponse.json({
    data: { logs: logs.rows, total },
    page,
    pageSize,
  });
}

// 账号删除日志
async function getAccountDeletionLogs(
  searchParams: URLSearchParams,
  page: number,
  pageSize: number,
  offset: number
) {
  const action = searchParams.get("action");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const whereParts: ReturnType<typeof sql>[] = [];

  if (action) whereParts.push(sql`a.action = ${action}`);
  if (startDate) whereParts.push(sql`a.created_at >= ${startDate}`);
  if (endDate) whereParts.push(sql`a.created_at <= ${endDate + " 23:59:59"}`);

  const whereClause = whereParts.length > 0
    ? sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    : sql``;

  const countResult = await sql<{ total: string | number }>`SELECT COUNT(*) as total FROM account_deletion_logs a ${whereClause}`.execute(db);
  const total = Number(countResult.rows[0]?.total ?? 0);

  const logs = await sql<Record<string, any>>`SELECT a.*, u.name as user_name, op.name as operator_name
     FROM account_deletion_logs a
     LEFT JOIN users u ON a.user_id = u.id
     LEFT JOIN users op ON a.operator_id = op.id
     ${whereClause}
     ORDER BY a.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`.execute(db);

  return NextResponse.json({
    data: { logs: logs.rows, total },
    page,
    pageSize,
  });
}

// DELETE /api/admin/logs - 清理日志
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { type, beforeDate } = body;

    if (!type || !beforeDate) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    let result: any;
    switch (type) {
      case "admin_operation":
        result = await db.deleteFrom("admin_operation_logs")
          .where("created_at", "<", new Date(beforeDate))
          .execute();
        break;
      case "download":
        result = await db.deleteFrom("download_logs")
          .where("created_at", "<", new Date(beforeDate))
          .execute();
        break;
      case "view":
        result = await db.deleteFrom("view_logs")
          .where("created_at", "<", new Date(beforeDate))
          .execute();
        break;
      case "account_deletion":
        result = await db.deleteFrom("account_deletion_logs")
          .where("created_at", "<", new Date(beforeDate))
          .execute();
        break;
      default:
        return NextResponse.json({ error: "未知日志类型" }, { status: 400 });
    }

    const deletedCount = (result as any)?.[0]?.affectedRows || 0;

    // 记录审计日志
    try {
      const { logAudit } = await import("@/lib/audit-log");
      await logAudit({
        operatorId: parseInt((session.user as any).id),
        operation: "settings_update" as any,
        detail: {
          action: "clean_logs",
          logType: type,
          beforeDate,
          deletedCount,
        },
      });
    } catch {}

    return NextResponse.json({
      message: `已清理 ${deletedCount} 条日志`,
      deletedCount,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/logs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
