import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
    query("SELECT COUNT(*) as count FROM admin_operation_logs"),
    query("SELECT COUNT(*) as count FROM download_logs"),
    query("SELECT COUNT(*) as count FROM view_logs"),
    query("SELECT COUNT(*) as count FROM account_deletion_logs"),
    query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM admin_operation_logs
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) ORDER BY date`
    ),
  ]);

  // 今日统计
  const [todayDownloads, todayViews, todayOps] = await Promise.all([
    query("SELECT COUNT(*) as count FROM download_logs WHERE created_at >= CURDATE()"),
    query("SELECT COUNT(*) as count FROM view_logs WHERE created_at >= CURDATE()"),
    query("SELECT COUNT(*) as count FROM admin_operation_logs WHERE created_at >= CURDATE()"),
  ]);

  // 下载量趋势（7天）
  const downloadTrend = await query(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM download_logs
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at) ORDER BY date`
  );

  // 浏览量趋势（7天）
  const viewTrend = await query(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM view_logs
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
     GROUP BY DATE(created_at) ORDER BY date`
  );

  // 操作类型分布
  const opDistribution = await query(
    `SELECT operation, COUNT(*) as count FROM admin_operation_logs GROUP BY operation ORDER BY count DESC LIMIT 20`
  );

  return NextResponse.json({
    data: {
      totalAdminOps: (adminOps as any[])[0]?.count || 0,
      totalDownloads: (downloads as any[])[0]?.count || 0,
      totalViews: (views as any[])[0]?.count || 0,
      totalAccountDeletions: (accountDeletions as any[])[0]?.count || 0,
      todayDownloads: (todayDownloads as any[])[0]?.count || 0,
      todayViews: (todayViews as any[])[0]?.count || 0,
      todayOps: (todayOps as any[])[0]?.count || 0,
      opsTrend: recentOps,
      downloadTrend,
      viewTrend,
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

  let where = "1=1";
  const values: any[] = [];

  if (operation) {
    where += " AND a.operation = ?";
    values.push(operation);
  }
  if (operatorId) {
    where += " AND a.operator_id = ?";
    values.push(parseInt(operatorId));
  }
  if (startDate) {
    where += " AND a.created_at >= ?";
    values.push(startDate);
  }
  if (endDate) {
    where += " AND a.created_at <= ?";
    values.push(endDate + " 23:59:59");
  }

  const countResult = (await query(
    `SELECT COUNT(*) as total FROM admin_operation_logs a WHERE ${where}`,
    values
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  const logs = await query(
    `SELECT a.*, u.name as operator_name, ut.name as target_user_name
     FROM admin_operation_logs a
     LEFT JOIN users u ON a.operator_id = u.id
     LEFT JOIN users ut ON a.target_user_id = ut.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  // 操作类型列表（用于筛选下拉）
  const operations = await query(
    "SELECT DISTINCT operation FROM admin_operation_logs ORDER BY operation"
  );

  return NextResponse.json({
    data: { logs, total, operations },
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

  let where = "1=1";
  const values: any[] = [];

  if (imageId) {
    where += " AND d.image_id = ?";
    values.push(parseInt(imageId));
  }
  if (userId) {
    where += " AND d.user_id = ?";
    values.push(parseInt(userId));
  }
  if (startDate) {
    where += " AND d.created_at >= ?";
    values.push(startDate);
  }
  if (endDate) {
    where += " AND d.created_at <= ?";
    values.push(endDate + " 23:59:59");
  }

  const countResult = (await query(
    `SELECT COUNT(*) as total FROM download_logs d WHERE ${where}`,
    values
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  const logs = await query(
    `SELECT d.*, i.title as image_title, u.name as user_name
     FROM download_logs d
     LEFT JOIN images i ON d.image_id = i.id
     LEFT JOIN users u ON d.user_id = u.id
     WHERE ${where}
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  return NextResponse.json({
    data: { logs, total },
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

  let where = "1=1";
  const values: any[] = [];

  if (imageId) {
    where += " AND v.image_id = ?";
    values.push(parseInt(imageId));
  }
  if (userId) {
    where += " AND v.user_id = ?";
    values.push(parseInt(userId));
  }
  if (startDate) {
    where += " AND v.created_at >= ?";
    values.push(startDate);
  }
  if (endDate) {
    where += " AND v.created_at <= ?";
    values.push(endDate + " 23:59:59");
  }

  const countResult = (await query(
    `SELECT COUNT(*) as total FROM view_logs v WHERE ${where}`,
    values
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  const logs = await query(
    `SELECT v.*, i.title as image_title, u.name as user_name
     FROM view_logs v
     LEFT JOIN images i ON v.image_id = i.id
     LEFT JOIN users u ON v.user_id = u.id
     WHERE ${where}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  return NextResponse.json({
    data: { logs, total },
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

  let where = "1=1";
  const values: any[] = [];

  if (action) {
    where += " AND a.action = ?";
    values.push(action);
  }
  if (startDate) {
    where += " AND a.created_at >= ?";
    values.push(startDate);
  }
  if (endDate) {
    where += " AND a.created_at <= ?";
    values.push(endDate + " 23:59:59");
  }

  const countResult = (await query(
    `SELECT COUNT(*) as total FROM account_deletion_logs a WHERE ${where}`,
    values
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  const logs = await query(
    `SELECT a.*, u.name as user_name, op.name as operator_name
     FROM account_deletion_logs a
     LEFT JOIN users u ON a.user_id = u.id
     LEFT JOIN users op ON a.operator_id = op.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  return NextResponse.json({
    data: { logs, total },
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
        result = await query(
          "DELETE FROM admin_operation_logs WHERE created_at < ?",
          [beforeDate]
        );
        break;
      case "download":
        result = await query("DELETE FROM download_logs WHERE created_at < ?", [
          beforeDate,
        ]);
        break;
      case "view":
        result = await query("DELETE FROM view_logs WHERE created_at < ?", [
          beforeDate,
        ]);
        break;
      case "account_deletion":
        result = await query(
          "DELETE FROM account_deletion_logs WHERE created_at < ?",
          [beforeDate]
        );
        break;
      default:
        return NextResponse.json({ error: "未知日志类型" }, { status: 400 });
    }

    const deletedCount = (result as any)?.affectedRows || 0;

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