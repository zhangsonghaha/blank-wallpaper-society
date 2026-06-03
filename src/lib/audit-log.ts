/**
 * 管理员操作审计日志
 * 记录所有管理员关键操作，支持 IP 记录、详情存储和可疑操作告警
 */

import { db } from "@/lib/db";
import { sql } from "kysely";

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
  | "bot_config_connectivity_test"
  | "ai_provider_create"
  | "ai_model_create"
  | "ai_model_auto_discover"
  | "ai_model_set_default";

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

    await db.insertInto("admin_operation_logs")
      .values({
        operator_id: operatorId,
        target_user_id: targetUserId || null,
        operation,
        detail: JSON.stringify(logDetail),
      })
      .execute();

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

  // Build COUNT query
  let countQuery = db.selectFrom("admin_operation_logs")
    .select((eb) => eb.fn.countAll().as("count"));
  if (operation) {
    countQuery = countQuery.where("admin_operation_logs.operation", "=", operation as any);
  }
  if (operatorId) {
    countQuery = countQuery.where("admin_operation_logs.operator_id", "=", operatorId);
  }
  const countResult = await countQuery.executeTakeFirst();
  const total = Number(countResult?.count ?? 0);

  // Build main query with JOINs
  let mainQuery = db.selectFrom("admin_operation_logs as a")
    .leftJoin("users as u", "u.id", "a.operator_id")
    .leftJoin("users as ut", "ut.id", "a.target_user_id")
    .select((eb) => [
      eb.ref("a.id").as("id"),
      eb.ref("a.operation").as("operation"),
      eb.ref("a.operator_id").as("operator_id"),
      eb.ref("a.target_user_id").as("target_user_id"),
      eb.ref("a.detail").as("detail"),
      eb.ref("a.created_at").as("created_at"),
      sql<string | null>`u.name`.as("operator_name"),
      sql<string | null>`ut.name`.as("target_user_name"),
    ]);
  if (operation) {
    mainQuery = mainQuery.where("a.operation", "=", operation as any);
  }
  if (operatorId) {
    mainQuery = mainQuery.where("a.operator_id", "=", operatorId);
  }
  const logs = await mainQuery
    .orderBy("a.created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return { logs, total };
}