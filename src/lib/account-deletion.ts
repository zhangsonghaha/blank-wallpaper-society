import crypto from "crypto";
import { query, safeQuery } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";
import { hashPassword } from "@/lib/password";

/**
 * 账号注销与数据删除库
 * 
 * 提供用户自助注销、管理员封禁/删除等功能
 * 遵循《个人信息保护法》/GDPR 要求
 */

// 冷静期天数
const COOLING_OFF_DAYS = 7;

/**
 * 请求注销账号
 * - 检查用户状态是否为 active
 * - 设置注销相关字段，进入7天冷静期
 * - 记录操作日志
 */
export async function requestAccountDeletion(userId: number): Promise<{ scheduledAt: Date }> {
  // 检查用户状态
  const users = (await query(
    "SELECT id, status, name, email FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  const user = users[0];

  if (user.status === "suspended") {
    throw new Error("账号已被封禁，无法申请注销");
  }

  if (user.status === "pending_deletion") {
    throw new Error("账号已在注销流程中");
  }

  if (user.status === "deleted") {
    throw new Error("账号已注销");
  }

  if (user.status === "banned") {
    throw new Error("账号已被封禁，无法申请注销");
  }

  // 设置注销时间和计划删除时间
  const now = new Date();
  const scheduledAt = new Date(now.getTime() + COOLING_OFF_DAYS * 24 * 60 * 60 * 1000);

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE users SET 
        deletion_requested_at = NOW(), 
        deletion_scheduled_at = ?, 
        status = 'pending_deletion' 
      WHERE id = ?`,
      [scheduledAt, userId]
    );

    // 记录操作日志
    await conn.execute(
      `INSERT INTO account_deletion_logs (user_id, action, details) VALUES (?, 'requested', ?)`,
      [userId, JSON.stringify({
        userName: user.name,
        userEmail: user.email,
        scheduledAt: scheduledAt.toISOString(),
      })]
    );
  });

  return { scheduledAt };
}

/**
 * 取消注销请求
 * - 在冷静期内用户可以取消注销
 * - 清除注销字段，恢复 status = 'active'
 */
export async function cancelAccountDeletion(userId: number): Promise<void> {
  const users = (await query(
    "SELECT id, status FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].status !== "pending_deletion") {
    throw new Error("账号未在注销流程中，无法取消");
  }

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE users SET 
        deletion_requested_at = NULL, 
        deletion_scheduled_at = NULL, 
        status = 'active' 
      WHERE id = ?`,
      [userId]
    );

    // 记录操作日志
    await conn.execute(
      `INSERT INTO account_deletion_logs (user_id, action, details) VALUES (?, 'cancelled', ?)`,
      [userId, JSON.stringify({ cancelledAt: new Date().toISOString() })]
    );
  });
}

/**
 * 执行账号注销（匿名化处理）
 * - 匿名化用户信息
 * - 删除关联数据
 * - 保留其他用户可能依赖的数据（图片、合集等）
 */
export async function executeAccountDeletion(userId: number): Promise<void> {
  // 检查用户状态
  const users = (await query(
    "SELECT id, status, name, email FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].status === "deleted") {
    throw new Error("账号已注销");
  }

  const originalName = users[0].name;
  const originalEmail = users[0].email;

  // 匿名化用户信息
  const deletedEmail = `deleted_${userId}@deleted.com`;
  const deletedName = "已注销用户";
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const hashedPassword = await hashPassword(randomPassword);

  // 使用事务保护整个注销流程，确保数据一致性
  await withTransaction(async (conn) => {
    // 1. 匿名化用户信息
    await conn.execute(
      `UPDATE users SET 
        name = ?, 
        email = ?, 
        avatar = NULL, 
        password = ?, 
        status = 'deleted',
        deletion_requested_at = NULL,
        deletion_scheduled_at = NULL
      WHERE id = ?`,
      [deletedName, deletedEmail, hashedPassword, userId]
    );

    // 2. 删除用户收藏
    await conn.execute("DELETE FROM favorites WHERE user_id = ?", [userId]);

    // 3. 匿名化评论
    await conn.execute(
      "UPDATE comments SET content = '该评论已被删除', user_id = NULL WHERE user_id = ?",
      [userId]
    );

    // 4. 删除 OAuth 关联
    await conn.execute("DELETE FROM oauth_accounts WHERE user_id = ?", [userId]);

    // 5. 删除通知设置
    await conn.execute("DELETE FROM notification_settings WHERE user_id = ?", [userId]);

    // 6. 删除用户成就
    await conn.execute("DELETE FROM user_achievements WHERE user_id = ?", [userId]);

    // 7. 删除用户等级
    await conn.execute("DELETE FROM user_levels WHERE user_id = ?", [userId]);

    // 8. 停用 API Keys
    await conn.execute(
      "UPDATE api_keys SET status = 'revoked' WHERE user_id = ?",
      [userId]
    );

    // 9. 删除密码重置令牌
    await conn.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);

    // 10. 删除关注关系
    await conn.execute("DELETE FROM user_follows WHERE follower_id = ? OR following_id = ?", [userId, userId]);

    // 11. 删除用户通知
    await conn.execute("DELETE FROM notifications WHERE user_id = ?", [userId]);

    // 12. 合集改为匿名
    await conn.execute(
      "UPDATE collections SET user_id = NULL WHERE user_id = ?",
      [userId]
    );

    // 13. 记录操作日志
    await conn.execute(
      `INSERT INTO account_deletion_logs (user_id, action, details) VALUES (?, 'completed', ?)`,
      [userId, JSON.stringify({
        originalName,
        originalEmail,
        completedAt: new Date().toISOString(),
      })]
    );
  });
}

/**
 * 管理员封禁账号
 */
export async function suspendAccount(
  userId: number,
  operatorId: number,
  reason: string
): Promise<void> {
  const users = (await query(
    "SELECT id, status, role FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].role === "admin") {
    throw new Error("不能封禁管理员账号");
  }

  if (users[0].status === "suspended") {
    throw new Error("账号已被封禁");
  }

  if (users[0].status === "deleted") {
    throw new Error("账号已注销，无法封禁");
  }

  // 如果用户在注销流程中，取消注销并封禁
  await query(
    `UPDATE users SET 
      status = 'suspended', 
      banned_reason = ?, 
      banned_at = NOW(),
      deletion_requested_at = NULL,
      deletion_scheduled_at = NULL
    WHERE id = ?`,
    [reason, userId]
  );

  // 记录操作日志
  await query(
    `INSERT INTO account_deletion_logs (user_id, action, details, operator_id) VALUES (?, 'admin_suspended', ?, ?)`,
    [userId, JSON.stringify({ reason, fromStatus: users[0].status }), operatorId]
  );

  // 同时记录到管理操作日志
  await query(
    `INSERT INTO admin_operation_logs (operator_id, target_user_id, operation, detail) VALUES (?, ?, 'ban_user', ?)`,
    [operatorId, userId, JSON.stringify({ reason, fromStatus: users[0].status })]
  );
}

/**
 * 管理员解封账号
 */
export async function unsuspendAccount(
  userId: number,
  operatorId: number
): Promise<void> {
  const users = (await query(
    "SELECT id, status FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].status !== "suspended") {
    throw new Error("账号未被封禁");
  }

  await query(
    `UPDATE users SET 
      status = 'active', 
      banned_reason = NULL, 
      banned_at = NULL
    WHERE id = ?`,
    [userId]
  );

  // 记录到管理操作日志
  await query(
    `INSERT INTO admin_operation_logs (operator_id, target_user_id, operation, detail) VALUES (?, ?, 'unban_user', ?)`,
    [operatorId, userId, JSON.stringify({ fromStatus: "suspended", toStatus: "active" })]
  );
}

/**
 * 管理员直接删除账号
 */
export async function deleteAccountByAdmin(
  userId: number,
  operatorId: number,
  reason: string
): Promise<void> {
  const users = (await query(
    "SELECT id, status, role, name, email FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].role === "admin") {
    throw new Error("不能删除管理员账号");
  }

  if (users[0].status === "deleted") {
    throw new Error("账号已注销");
  }

  const originalName = users[0].name;
  const originalEmail = users[0].email;

  // 匿名化用户信息
  const deletedEmail = `deleted_${userId}_${Date.now()}@deleted.com`;
  const deletedName = "已删除用户";
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const hashedPassword = await hashPassword(randomPassword);

  await query(
    `UPDATE users SET 
      name = ?, 
      email = ?, 
      avatar = NULL, 
      password = ?, 
      status = 'deleted',
      deletion_requested_at = NULL,
      deletion_scheduled_at = NULL,
      banned_reason = ?,
      banned_at = NOW()
    WHERE id = ?`,
    [deletedName, deletedEmail, hashedPassword, `管理员删除: ${reason}`, userId]
  );

  // 删除用户收藏
  await safeQuery("DELETE FROM favorites WHERE user_id = ?", [userId]);

  // 匿名化评论
  await safeQuery(
    "UPDATE comments SET content = '该评论已被删除', user_id = NULL WHERE user_id = ?",
    [userId]
  );

  // 删除 OAuth 关联
  await safeQuery("DELETE FROM oauth_accounts WHERE user_id = ?", [userId]);

  // 停用 API Keys
  await safeQuery(
    "UPDATE api_keys SET status = 'revoked' WHERE user_id = ?",
    [userId]
  );

  // 删除密码重置令牌
  await safeQuery("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);

  // 删除关注关系
  await safeQuery("DELETE FROM user_follows WHERE follower_id = ? OR following_id = ?", [userId, userId]);

  // 删除用户通知
  await safeQuery("DELETE FROM notifications WHERE user_id = ?", [userId]);

  // 合集改为匿名
  await safeQuery(
    "UPDATE collections SET user_id = NULL WHERE user_id = ?",
    [userId]
  );

  // 记录操作日志
  await query(
    `INSERT INTO account_deletion_logs (user_id, action, details, operator_id) VALUES (?, 'admin_deleted', ?, ?)`,
    [userId, JSON.stringify({
      reason,
      originalName,
      originalEmail,
    }), operatorId]
  );

  // 同时记录到管理操作日志
  await query(
    `INSERT INTO admin_operation_logs (operator_id, target_user_id, operation, detail) VALUES (?, ?, 'delete_user', ?)`,
    [operatorId, userId, JSON.stringify({
      reason,
      originalName,
      originalEmail,
    })]
  );
}

/**
 * 获取用户注销状态
 */
export async function getAccountDeletionStatus(userId: number): Promise<{
  status: string;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
} | null> {
  const users = (await query(
    "SELECT status, deletion_requested_at, deletion_scheduled_at FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (users.length === 0) {
    return null;
  }

  return {
    status: users[0].status,
    deletionRequestedAt: users[0].deletion_requested_at,
    deletionScheduledAt: users[0].deletion_scheduled_at,
  };
}