import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query, safeQuery } from "@/lib/db";
import { getCache, setCache, delCache, clearPattern } from "@/lib/redis";

// GET /api/admin/users - 获取用户列表（分页、搜索、筛选）
export async function GET(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const roleFilter = searchParams.get("role") || "";
    const statusFilter = searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    // 缓存键
    const cacheKey = `admin:users:${page}:${limit}:${search}:${roleFilter}:${statusFilter}`;

    // 尝试从缓存获取
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 构建查询条件
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push("(u.name LIKE ? OR u.email LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (roleFilter) {
      const validRoles = ["admin", "moderator", "creator", "user"];
      if (validRoles.includes(roleFilter)) {
        conditions.push("u.role = ?");
        params.push(roleFilter);
      }
    }

    if (statusFilter) {
      const validStatuses = ["active", "banned", "suspended", "pending_deletion", "deleted"];
      if (validStatuses.includes(statusFilter)) {
        conditions.push("u.status = ?");
        params.push(statusFilter);
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 获取总数（独立容错）
    const countResult = await safeQuery(
      `SELECT COUNT(*) as count FROM users u ${whereClause}`,
      params,
      [{ count: 0 }]
    );
    const total = Number((countResult as any[])?.[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit) || 1;

    // 获取用户列表 + 统计信息（独立容错）
    const users = await safeQuery(
      `SELECT 
        u.id, u.email, u.name, u.avatar, u.role, u.status,
        u.banned_reason, u.banned_at, u.created_at, u.updated_at,
        u.deletion_requested_at, u.deletion_scheduled_at,
        COALESCE(upload_stats.upload_count, 0) as upload_count,
        COALESCE(fav_stats.favorite_count, 0) as favorite_count
      FROM users u
      LEFT JOIN (
        SELECT uploaded_by, COUNT(*) as upload_count 
        FROM images 
        WHERE uploaded_by IS NOT NULL 
        GROUP BY uploaded_by
      ) upload_stats ON u.id = upload_stats.uploaded_by
      LEFT JOIN (
        SELECT user_id, COUNT(*) as favorite_count 
        FROM favorites 
        GROUP BY user_id
      ) fav_stats ON u.id = fav_stats.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
      params,
      []
    );

    // 邮箱脱敏处理
    const maskedUsers = (Array.isArray(users) ? users : []).map((user: any) => ({
      ...user,
      email: maskEmail(user?.email),
    }));

    const result = {
      data: maskedUsers,
      total,
      page,
      limit,
      totalPages,
    };

    // 写入缓存，TTL 60秒
    await setCache(cacheKey, result, 60);

    return NextResponse.json(result);
  } catch (error) {
    console.error("获取用户列表失败:", error);
    return NextResponse.json({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  }
}

// PATCH /api/admin/users - 批量更新用户信息（管理员操作）
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, role, status, bannedReason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "缺少用户ID" },
        { status: 400 }
      );
    }

    // 不能操作自己
    const operatorId = (session.user as any).id;
    if (Number(userId) === Number(operatorId)) {
      return NextResponse.json(
        { error: "不能修改自己的角色或状态" },
        { status: 400 }
      );
    }

    // 检查目标用户是否是管理员
    const targetUser = (await query(
      "SELECT id, role, status FROM users WHERE id = ?",
      [userId]
    )) as any[];

    if (targetUser.length === 0) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      );
    }

    if (targetUser[0].role === "admin") {
      return NextResponse.json(
        { error: "不能修改其他管理员的角色或状态" },
        { status: 403 }
      );
    }

    // 记录操作日志
    const logDetail: any = {};
    const updates: string[] = [];
    const updateParams: any[] = [];

    if (role !== undefined) {
      const validRoles = ["admin", "moderator", "creator", "user"];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: "无效的角色" },
          { status: 400 }
        );
      }
      logDetail.from_role = targetUser[0].role;
      logDetail.to_role = role;
      updates.push("role = ?");
      updateParams.push(role);
    }

    if (status !== undefined) {
      const validStatuses = ["active", "banned"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "无效的状态" },
          { status: 400 }
        );
      }
      logDetail.from_status = targetUser[0].status;
      logDetail.to_status = status;

      if (status === "banned") {
        updates.push("status = ?, banned_reason = ?, banned_at = NOW()");
        updateParams.push(status, bannedReason || "管理员封禁");
      } else {
        updates.push("status = ?, banned_reason = NULL, banned_at = NULL");
        updateParams.push(status);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "没有需要更新的字段" },
        { status: 400 }
      );
    }

    updateParams.push(userId);

    await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      updateParams
    );

    // 清除用户列表缓存
    await clearPattern("admin:users:*");

    // 记录操作日志
    const operation = status === "banned" ? "ban_user" 
      : status === "active" && targetUser[0].status === "banned" ? "unban_user"
      : role ? "change_role" : "update_user";

    await query(
      "INSERT INTO admin_operation_logs (operator_id, target_user_id, operation, detail) VALUES (?, ?, ?, ?)",
      [operatorId, userId, operation, JSON.stringify(logDetail)]
    );

    return NextResponse.json({ message: "更新成功" });
  } catch (error) {
    console.error("更新用户失败:", error);
    return NextResponse.json({ error: "更新用户失败" }, { status: 500 });
  }
}

// 邮箱脱敏函数
function maskEmail(email: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return local[0] + "***@" + domain;
  return local[0] + "***" + local[local.length - 1] + "@" + domain;
}