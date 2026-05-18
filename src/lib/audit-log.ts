/**
 * 管理员操作审计日志
 * 记录所有管理员关键操作，支持 IP 记录、详情存储和可疑操作告警
 */

import { query } from "@/lib/db";

// 操作类型
export type AuditOperation =
  | "review_approve"
  | "review_reject"
  | "user_ban"
  | "user_unban"
  | "user_delete"
  | "user_role_change"
  | "image_delete"
  | "image_batch_delete"
  | "category_create"
  | "category_update"
  | "category_delete"
  | "settings_update"
  | "crawl_start"
  | "crawl_stop"
  | "notification_send"
  | "account_deletion_approve"
  | "account_deletion_cancel"
  | "bot_config_create"
  | "bot_config_update"
  | "bot_config_delete"
  | "bot_config_test"
  | "bot_config_connectivity_test";

// 敏感操作（需要额外关注）
const SENSITIVE_OPERATIONS: AuditOperation[] = [
  "user_ban",
  "user_delete",
  "image_batch_delete",
  "account_deletion_approve",
  "user_role_change",
];

interface AuditLogParams {
  operatorId: number;
  operation: AuditOperation;
  targetUserId?: number;
  detail?: Record<string, any>;
  ip?: string;
}

/**
 * 记录审计日志
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const { operatorId, operation, targetUserId, detail, ip } = params;

    const logDetail = {
      ...detail,
      ...(ip ? { ip } : {}),
      timestamp: new Date().toISOString(),
    };

    await query(
      `INSERT INTO admin_operation_logs (operator_id, target_user_id, operation, detail)
       VALUES (?, ?, ?, ?)`,
      [
        operatorId,
        targetUserId || null,
        operation,
        JSON.stringify(logDetail),
      ]
    );

    // 敏感操作告警
    if (SENSITIVE_OPERATIONS.includes(operation)) {
      console.warn(
        `[AUDIT ALERT] 敏感操作: ${operation}, 操作人ID: ${operatorId}, 目标用户ID: ${targetUserId || "N/A"}, 详情: ${JSON.stringify(logDetail)}`
      );
    }
  } catch (error) {
    console.error("[AUDIT] 记录审计日志失败:", error);
  }
}

/**
 * 获取审计日志列表
 */
export async function getAuditLogs(params: {
  operation?: string;
  operatorId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  const { operation, operatorId, limit = 50, offset = 0 } = params;

  let where = "1=1";
  const values: any[] = [];

  if (operation) {
    where += " AND operation = ?";
    values.push(operation);
  }
  if (operatorId) {
    where += " AND operator_id = ?";
    values.push(operatorId);
  }

  const countResult = (await query(
    `SELECT COUNT(*) as total FROM admin_operation_logs WHERE ${where}`,
    values
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  const logs = (await query(
    `SELECT a.*, u.name as operator_name, ut.name as target_user_name
     FROM admin_operation_logs a
     LEFT JOIN users u ON a.operator_id = u.id
     LEFT JOIN users ut ON a.target_user_id = ut.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, String(limit), String(offset)]
  )) as any[];

  return { logs, total };
}