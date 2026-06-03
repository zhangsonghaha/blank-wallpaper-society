import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, safeExecute } from "@/lib/db";
import { sql } from "kysely";
import { getCache, setCache, delCache, clearPattern } from "@/lib/redis";
import { hashPassword } from "@/lib/password";

// GET /api/admin/users/[id] - 获取用户详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    // 尝试从缓存获取
    const cacheKey = `admin:user:${userId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 获取用户详情 + 统计（独立容错）
    const users = await safeExecute(
      () => sql<Record<string, any>>`SELECT 
        u.id, u.email, u.name, u.avatar, u.role, u.status,
        u.banned_reason, u.banned_at, u.created_at, u.updated_at,
        u.deletion_requested_at, u.deletion_scheduled_at,
        COALESCE(upload_stats.upload_count, 0) as upload_count,
        COALESCE(fav_stats.favorite_count, 0) as favorite_count
      FROM users u
      LEFT JOIN (
        SELECT uploaded_by, COUNT(*) as upload_count 
        FROM images WHERE uploaded_by IS NOT NULL GROUP BY uploaded_by
      ) upload_stats ON u.id = upload_stats.uploaded_by
      LEFT JOIN (
        SELECT user_id, COUNT(*) as favorite_count 
        FROM favorites GROUP BY user_id
      ) fav_stats ON u.id = fav_stats.user_id
      WHERE u.id = ${userId}`.execute(db),
      { rows: [] } as { rows: any[] },
      "user-detail"
    );

    if (!Array.isArray(users.rows) || users.rows.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const user = users.rows[0];

    // 获取最近上传的图片（独立容错）
    const recentImages = await safeExecute(
      () => db.selectFrom("images")
        .where("uploaded_by", "=", userId)
        .select(["id", "title", "url", "thumbnail_url", "created_at", "status"])
        .orderBy("created_at", "desc")
        .limit(5)
        .execute(),
      [] as any[],
      "user-recent-images"
    );

    // 获取操作日志（独立容错）
    const operationLogs = await safeExecute(
      () => sql<Record<string, any>>`SELECT aol.*, u.name as operator_name
       FROM admin_operation_logs aol
       LEFT JOIN users u ON aol.operator_id = u.id
       WHERE aol.target_user_id = ${userId}
       ORDER BY aol.created_at DESC
       LIMIT 10`.execute(db),
      { rows: [] } as { rows: any[] },
      "user-operation-logs"
    );

    const result = {
      ...user,
      recentImages: Array.isArray(recentImages) ? recentImages : [],
      operationLogs: Array.isArray(operationLogs.rows) ? operationLogs.rows : [],
    };

    // 写入缓存，TTL 60秒
    await setCache(cacheKey, result, 60);

    return NextResponse.json(result);
  } catch (error) {
    console.error("获取用户详情失败:", error);
    return NextResponse.json({ error: "获取用户详情失败" }, { status: 500 });
  }
}

// PATCH /api/admin/users/[id] - 修改用户角色/状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    // 不能操作自己
    const operatorId = (session.user as any).id;
    if (userId === Number(operatorId)) {
      return NextResponse.json(
        { error: "不能修改自己的角色或状态" },
        { status: 400 }
      );
    }

    // 检查目标用户
    const targetUser = await db.selectFrom("users")
      .where("id", "=", userId)
      .select(["id", "role", "status"])
      .execute();

    if (targetUser.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (targetUser[0].role === "admin") {
      return NextResponse.json(
        { error: "不能修改其他管理员的角色或状态" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, status, bannedReason, resetPassword } = body;

    const logDetail: any = {};
    const updates: Record<string, any> = {};

    if (resetPassword) {
      if (resetPassword.length < 6) {
        return NextResponse.json({ error: "密码至少6位" }, { status: 400 });
      }
      const hash = await hashPassword(resetPassword);
      updates.password = hash;
      logDetail.operation = "reset_password";
    }

    if (role !== undefined) {
      const validRoles = ["admin", "moderator", "creator", "user"];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: "无效的角色" }, { status: 400 });
      }
      logDetail.from_role = targetUser[0].role;
      logDetail.to_role = role;
      updates.role = role;
    }

    if (status !== undefined) {
      const validStatuses = ["active", "banned", "suspended", "pending_deletion", "deleted"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "无效的状态" }, { status: 400 });
      }
      logDetail.from_status = targetUser[0].status;
      logDetail.to_status = status;

      if (status === "banned" || status === "suspended") {
        updates.status = status;
        updates.banned_reason = bannedReason || "管理员封禁";
        updates.banned_at = sql`NOW()`;
      } else {
        updates.status = status;
        updates.banned_reason = null;
        updates.banned_at = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "没有需要更新的字段" },
        { status: 400 }
      );
    }

    await db.updateTable("users")
      .set(updates)
      .where("id", "=", userId)
      .execute();

    // 清除该用户的缓存和用户列表缓存
    await delCache(`admin:user:${userId}`);
    await clearPattern("admin:users:*");

    // 记录操作日志
    const operation =
      resetPassword
        ? "reset_password"
        : status === "suspended"
          ? "ban_user"
          : status === "banned"
            ? "ban_user"
            : status === "active" && (targetUser[0].status === "banned" || targetUser[0].status === "suspended")
              ? "unban_user"
              : role
                ? "change_role"
                : "update_user";

    await db.insertInto("admin_operation_logs")
      .values({
        operator_id: operatorId,
        target_user_id: userId,
        operation,
        detail: JSON.stringify(logDetail),
      })
      .execute();

    return NextResponse.json({ message: "更新成功" });
  } catch (error) {
    console.error("更新用户失败:", error);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - 删除用户（软删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    // 不能删除自己
    const operatorId = (session.user as any).id;
    if (userId === Number(operatorId)) {
      return NextResponse.json(
        { error: "不能删除自己" },
        { status: 400 }
      );
    }

    // 检查目标用户
    const targetUser = await db.selectFrom("users")
      .where("id", "=", userId)
      .select(["id", "role", "email", "name"])
      .execute();

    if (targetUser.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (targetUser[0].role === "admin") {
      return NextResponse.json(
        { error: "不能删除管理员" },
        { status: 403 }
      );
    }

    // 软删除
    const deletedEmail = `deleted_${userId}_${Date.now()}@deleted.com`;
    const deletedName = `已删除用户`;

    await db.updateTable("users")
      .set({
        email: deletedEmail,
        name: deletedName,
        avatar: null,
        status: "banned",
        banned_reason: "账户已删除",
        banned_at: sql`NOW()`,
      })
      .where("id", "=", userId)
      .execute();

    // 清除该用户的缓存和用户列表缓存
    await delCache(`admin:user:${userId}`);
    await clearPattern("admin:users:*");

    // 记录操作日志
    await db.insertInto("admin_operation_logs")
      .values({
        operator_id: operatorId,
        target_user_id: userId,
        operation: "delete_user",
        detail: JSON.stringify({
          original_email: targetUser[0].email || "",
          original_name: targetUser[0].name || "",
        }),
      })
      .execute();

    return NextResponse.json({ message: "用户已删除" });
  } catch (error) {
    console.error("删除用户失败:", error);
    return NextResponse.json({ error: "删除用户失败" }, { status: 500 });
  }
}
