import crypto from "crypto";
import { db, safeExecute } from "@/lib/db";
import { sql } from "kysely";
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
  const users = await db
    .selectFrom("users")
    .select(["id", "status", "name", "email"])
    .where("id", "=", userId)
    .execute();

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

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("users")
      .set({
        deletion_requested_at: now,
        deletion_scheduled_at: scheduledAt,
        status: "pending_deletion",
      })
      .where("id", "=", userId)
      .execute();

    // 记录操作日志
    await trx
      .insertInto("account_deletion_logs")
      .values({
        user_id: userId,
        action: "requested",
        details: JSON.stringify({
          userName: user.name,
          userEmail: user.email,
          scheduledAt: scheduledAt.toISOString(),
        }),
      })
      .execute();
  });

  return { scheduledAt };
}

/**
 * 取消注销请求
 * - 在冷静期内用户可以取消注销
 * - 清除注销字段，恢复 status = 'active'
 */
export async function cancelAccountDeletion(userId: number): Promise<void> {
  const users = await db
    .selectFrom("users")
    .select(["id", "status"])
    .where("id", "=", userId)
    .execute();

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].status !== "pending_deletion") {
    throw new Error("账号未在注销流程中，无法取消");
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable("users")
      .set({
        deletion_requested_at: null,
        deletion_scheduled_at: null,
        status: "active",
      })
      .where("id", "=", userId)
      .execute();

    // 记录操作日志
    await trx
      .insertInto("account_deletion_logs")
      .values({
        user_id: userId,
        action: "cancelled",
        details: JSON.stringify({ cancelledAt: new Date().toISOString() }),
      })
      .execute();
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
  const users = await db
    .selectFrom("users")
    .select(["id", "status", "name", "email"])
    .where("id", "=", userId)
    .execute();

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
  await db.transaction().execute(async (trx) => {
    // 1. 匿名化用户信息
    await trx
      .updateTable("users")
      .set({
        name: deletedName,
        email: deletedEmail,
        avatar: null,
        password: hashedPassword,
        status: "deleted",
        deletion_requested_at: null,
        deletion_scheduled_at: null,
      })
      .where("id", "=", userId)
      .execute();

    // 2. 删除用户收藏
    await trx.deleteFrom("favorites").where("user_id", "=", userId).execute();

    // 3. 匿名化评论（user_id 为 NOT NULL 列，用 raw SQL 绕过类型限制）
    await sql`UPDATE comments SET content = '该评论已被删除', user_id = NULL WHERE user_id = ${userId}`.execute(trx);

    // 4. 删除 OAuth 关联
    await trx.deleteFrom("oauth_accounts").where("user_id", "=", userId).execute();

    // 5. 删除通知设置
    await trx.deleteFrom("notification_settings").where("user_id", "=", userId).execute();

    // 6. 删除用户成就
    await trx.deleteFrom("user_achievements").where("user_id", "=", userId).execute();

    // 7. 删除用户等级
    await trx.deleteFrom("user_levels").where("user_id", "=", userId).execute();

    // 8. 停用 API Keys
    await trx
      .updateTable("api_keys")
      .set({ is_active: 0 })
      .where("user_id", "=", userId)
      .execute();

    // 9. 删除密码重置令牌
    await trx.deleteFrom("password_reset_tokens").where("user_id", "=", userId).execute();

    // 10. 删除关注关系
    await trx
      .deleteFrom("user_follows")
      .where((eb) =>
        eb.or([eb("follower_id", "=", userId), eb("following_id", "=", userId)])
      )
      .execute();

    // 11. 删除用户通知
    await trx.deleteFrom("notifications").where("user_id", "=", userId).execute();

    // 12. 合集改为匿名（user_id 为 NOT NULL 列，用 raw SQL 绕过类型限制）
    await sql`UPDATE collections SET user_id = NULL WHERE user_id = ${userId}`.execute(trx);

    // 13. 记录操作日志
    await trx
      .insertInto("account_deletion_logs")
      .values({
        user_id: userId,
        action: "completed",
        details: JSON.stringify({
          originalName,
          originalEmail,
          completedAt: new Date().toISOString(),
        }),
      })
      .execute();
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
  const users = await db
    .selectFrom("users")
    .select(["id", "status", "role"])
    .where("id", "=", userId)
    .execute();

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
  await db
    .updateTable("users")
    .set({
      status: "suspended",
      banned_reason: reason,
      banned_at: sql`NOW()`,
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    })
    .where("id", "=", userId)
    .execute();

  // 记录操作日志
  await db
    .insertInto("account_deletion_logs")
    .values({
      user_id: userId,
      action: "admin_suspended",
      details: JSON.stringify({ reason, fromStatus: users[0].status }),
      operator_id: operatorId,
    })
    .execute();

  // 同时记录到管理操作日志
  await db
    .insertInto("admin_operation_logs")
    .values({
      operator_id: operatorId,
      target_user_id: userId,
      operation: "ban_user",
      detail: JSON.stringify({ reason, fromStatus: users[0].status }),
    })
    .execute();
}

/**
 * 管理员解封账号
 */
export async function unsuspendAccount(
  userId: number,
  operatorId: number
): Promise<void> {
  const users = await db
    .selectFrom("users")
    .select(["id", "status"])
    .where("id", "=", userId)
    .execute();

  if (users.length === 0) {
    throw new Error("用户不存在");
  }

  if (users[0].status !== "suspended") {
    throw new Error("账号未被封禁");
  }

  await db
    .updateTable("users")
    .set({
      status: "active",
      banned_reason: null,
      banned_at: null,
    })
    .where("id", "=", userId)
    .execute();

  // 记录到管理操作日志
  await db
    .insertInto("admin_operation_logs")
    .values({
      operator_id: operatorId,
      target_user_id: userId,
      operation: "unban_user",
      detail: JSON.stringify({ fromStatus: "suspended", toStatus: "active" }),
    })
    .execute();
}

/**
 * 管理员直接删除账号
 */
export async function deleteAccountByAdmin(
  userId: number,
  operatorId: number,
  reason: string
): Promise<void> {
  const users = await db
    .selectFrom("users")
    .select(["id", "status", "role", "name", "email"])
    .where("id", "=", userId)
    .execute();

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

  await db
    .updateTable("users")
    .set({
      name: deletedName,
      email: deletedEmail,
      avatar: null,
      password: hashedPassword,
      status: "deleted",
      deletion_requested_at: null,
      deletion_scheduled_at: null,
      banned_reason: `管理员删除: ${reason}`,
      banned_at: sql`NOW()`,
    })
    .where("id", "=", userId)
    .execute();

  // 删除用户收藏
  await safeExecute(
    () => db.deleteFrom("favorites").where("user_id", "=", userId).execute(),
    [],
    "delete-favorites"
  );

  // 匿名化评论（user_id 为 NOT NULL 列，用 raw SQL 绕过类型限制）
  await safeExecute(
    () => sql`UPDATE comments SET content = '该评论已被删除', user_id = NULL WHERE user_id = ${userId}`.execute(db),
    { rows: [] },
    "anonymize-comments"
  );

  // 删除 OAuth 关联
  await safeExecute(
    () => db.deleteFrom("oauth_accounts").where("user_id", "=", userId).execute(),
    [],
    "delete-oauth"
  );

  // 停用 API Keys
  await safeExecute(
    () =>
      db
        .updateTable("api_keys")
        .set({ is_active: 0 })
        .where("user_id", "=", userId)
        .execute(),
    [],
    "revoke-api-keys"
  );

  // 删除密码重置令牌
  await safeExecute(
    () => db.deleteFrom("password_reset_tokens").where("user_id", "=", userId).execute(),
    [],
    "delete-reset-tokens"
  );

  // 删除关注关系
  await safeExecute(
    () =>
      db
        .deleteFrom("user_follows")
        .where((eb) =>
          eb.or([eb("follower_id", "=", userId), eb("following_id", "=", userId)])
        )
        .execute(),
    [],
    "delete-follows"
  );

  // 删除用户通知
  await safeExecute(
    () => db.deleteFrom("notifications").where("user_id", "=", userId).execute(),
    [],
    "delete-notifications"
  );

  // 合集改为匿名（user_id 为 NOT NULL 列，用 raw SQL 绕过类型限制）
  await safeExecute(
    () => sql`UPDATE collections SET user_id = NULL WHERE user_id = ${userId}`.execute(db),
    { rows: [] },
    "anonymize-collections"
  );

  // 记录操作日志
  await db
    .insertInto("account_deletion_logs")
    .values({
      user_id: userId,
      action: "admin_deleted",
      details: JSON.stringify({
        reason,
        originalName,
        originalEmail,
      }),
      operator_id: operatorId,
    })
    .execute();

  // 同时记录到管理操作日志
  await db
    .insertInto("admin_operation_logs")
    .values({
      operator_id: operatorId,
      target_user_id: userId,
      operation: "delete_user",
      detail: JSON.stringify({
        reason,
        originalName,
        originalEmail,
      }),
    })
    .execute();
}

/**
 * 获取用户注销状态
 */
export async function getAccountDeletionStatus(userId: number): Promise<{
  status: string;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
} | null> {
  const users = await db
    .selectFrom("users")
    .select(["status", "deletion_requested_at", "deletion_scheduled_at"])
    .where("id", "=", userId)
    .execute();

  if (users.length === 0) {
    return null;
  }

  return {
    status: users[0].status || "unknown",
    deletionRequestedAt: users[0].deletion_requested_at
      ? new Date(users[0].deletion_requested_at).toISOString()
      : null,
    deletionScheduledAt: users[0].deletion_scheduled_at
      ? new Date(users[0].deletion_scheduled_at).toISOString()
      : null,
  };
}
