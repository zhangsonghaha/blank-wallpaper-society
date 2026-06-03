/**
 * 创作者认证与品牌体系库
 * 提供认证申请、审核、品牌资料管理等核心功能
 */

import { db } from "@/lib/db";
import { sql } from "kysely";
import { pushNotification } from "@/lib/notification";

// === 类型定义 ===

export interface VerificationApplication {
  real_name: string;
  id_type: string;
  id_number: string;
  portfolio_url?: string;
  brand_name?: string;
  brand_description?: string;
}

export interface BrandProfile {
  brand_name: string;
  brand_description?: string;
  brand_website?: string;
  social_links?: Record<string, string>;
}

export interface VerificationStatus {
  verification_status: "none" | "pending" | "approved" | "rejected";
  is_verified: number;
  verified_at: string | null;
  verification_applied_at: string | null;
  verification_rejected_reason: string | null;
  brand_name: string | null;
  brand_description: string | null;
  brand_website: string | null;
  social_links: Record<string, string> | null;
}

// === 申请认证 ===

export async function applyForVerification(
  userId: number,
  data: VerificationApplication
): Promise<{ success: boolean; message: string }> {
  // 检查用户当前状态
  const rows = await db.selectFrom("users")
    .where("id", "=", userId)
    .select(["verification_status"])
    .execute();

  if (rows.length === 0) {
    return { success: false, message: "用户不存在" };
  }

  const currentStatus = rows[0].verification_status;
  if (currentStatus === "pending") {
    return { success: false, message: "您已提交认证申请，请等待审核" };
  }
  if (currentStatus === "approved") {
    return { success: false, message: "您已是认证创作者" };
  }

  // 提交认证申请
  await db.updateTable("users")
    .set({
      verification_status: "pending",
      verification_applied_at: sql`NOW()`,
      verification_rejected_reason: null,
      verification_real_name: data.real_name,
      verification_id_type: data.id_type,
      verification_id_number: data.id_number,
      verification_portfolio_url: data.portfolio_url || null,
      brand_name: sql`COALESCE(${data.brand_name || null}, brand_name)`,
      brand_description: sql`COALESCE(${data.brand_description || null}, brand_description)`,
    })
    .where("id", "=", userId)
    .execute();

  return { success: true, message: "认证申请已提交，请等待管理员审核" };
}

// === 审核认证 ===

export async function reviewVerification(
  userId: number,
  reviewerId: number,
  action: "approve" | "reject",
  reason?: string
): Promise<{ success: boolean; message: string }> {
  // 检查用户状态
  const rows = await db.selectFrom("users")
    .where("id", "=", userId)
    .select(["verification_status", "name"])
    .execute();

  if (rows.length === 0) {
    return { success: false, message: "用户不存在" };
  }

  if (rows[0].verification_status !== "pending") {
    return { success: false, message: "该用户没有待审核的认证申请" };
  }

  if (action === "approve") {
    await db.updateTable("users")
      .set({
        verification_status: "approved",
        is_verified: 1,
        verified_at: sql`NOW()`,
      })
      .where("id", "=", userId)
      .execute();

    // 发送通知
    await pushNotification({
      userId,
      type: "system",
      title: "创作者认证已通过",
      content: "恭喜您！您的创作者认证申请已通过审核，现在可以使用品牌资料等专属功能。",
      relatedId: userId,
      relatedType: "user",
    });

    return { success: true, message: "认证已通过" };
  } else {
    await db.updateTable("users")
      .set({
        verification_status: "rejected",
        verification_rejected_reason: reason || null,
        is_verified: 0,
      })
      .where("id", "=", userId)
      .execute();

    // 发送通知
    await pushNotification({
      userId,
      type: "system",
      title: "创作者认证未通过",
      content: reason
        ? `您的创作者认证申请未通过审核，原因：${reason}。您可以修改信息后重新申请。`
        : "您的创作者认证申请未通过审核，您可以修改信息后重新申请。",
      relatedId: userId,
      relatedType: "user",
    });

    return { success: true, message: "认证已拒绝" };
  }
}

// === 获取认证状态 ===

export async function getVerificationStatus(
  userId: number
): Promise<VerificationStatus | null> {
  const rows = await db.selectFrom("users")
    .where("id", "=", userId)
    .select([
      "verification_status", "is_verified", "verified_at",
      "verification_applied_at", "verification_rejected_reason",
      "brand_name", "brand_description", "brand_website", "social_links",
    ])
    .execute();

  if (rows.length === 0) return null;

  const row = rows[0];
  const socialLinks = row.social_links
    ? (typeof row.social_links === "string" ? JSON.parse(row.social_links) : row.social_links) as Record<string, string>
    : null;

  return {
    verification_status: row.verification_status || "none",
    is_verified: row.is_verified ?? 0,
    verified_at: row.verified_at ? row.verified_at.toISOString() : null,
    verification_applied_at: row.verification_applied_at ? row.verification_applied_at.toISOString() : null,
    verification_rejected_reason: row.verification_rejected_reason,
    brand_name: row.brand_name,
    brand_description: row.brand_description,
    brand_website: row.brand_website,
    social_links: socialLinks,
  };
}

// === 更新品牌资料（仅认证创作者可用） ===

export async function updateBrandProfile(
  userId: number,
  data: BrandProfile
): Promise<{ success: boolean; message: string }> {
  // 检查是否为认证创作者
  const rows = await db.selectFrom("users")
    .where("id", "=", userId)
    .select(["is_verified", "verification_status"])
    .execute();

  if (rows.length === 0) {
    return { success: false, message: "用户不存在" };
  }

  if (rows[0].is_verified !== 1 && rows[0].verification_status !== "approved") {
    return { success: false, message: "仅认证创作者可更新品牌资料" };
  }

  await db.updateTable("users")
    .set({
      brand_name: data.brand_name,
      brand_description: data.brand_description || null,
      brand_website: data.brand_website || null,
      social_links: data.social_links ? JSON.stringify(data.social_links) : null,
    })
    .where("id", "=", userId)
    .execute();

  return { success: true, message: "品牌资料已更新" };
}

// === 获取认证创作者列表（公开） ===

export async function getVerifiedCreators(options: {
  page?: number;
  limit?: number;
  sort?: string;
}): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 50);
  const offset = (page - 1) * limit;

  // 获取总数
  const countResult = await db.selectFrom("users")
    .where("is_verified", "=", 1)
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst();
  const total = Number(countResult?.count ?? 0);

  // 获取列表
  const validSorts = ["verified_at", "images_count", "followers_count"];
  const sort = validSorts.includes(options.sort || "") ? options.sort : "verified_at";

  let orderByExpr: string;
  if (sort === "images_count") {
    orderByExpr = "img_count DESC";
  } else if (sort === "followers_count") {
    orderByExpr = "follower_count DESC";
  } else {
    orderByExpr = "u.verified_at DESC";
  }

  const rows = await db.selectFrom("users as u")
    .where("u.is_verified", "=", 1)
    .select((eb) => [
      "u.id", "u.name", "u.avatar", "u.bio", "u.brand_name", "u.brand_description",
      "u.brand_website", "u.social_links", "u.verified_at",
      sql<number>`(SELECT COUNT(*) FROM images WHERE uploaded_by = u.id AND status = 'approved')`.as("img_count"),
      sql<number>`(SELECT COUNT(*) FROM user_follows WHERE following_id = u.id)`.as("follower_count"),
    ])
    .orderBy(sql.raw(orderByExpr))
    .limit(limit)
    .offset(offset)
    .execute();

  // 解析 social_links JSON
  const data = rows.map((row) => ({
    ...row,
    img_count: Number(row.img_count ?? 0),
    follower_count: Number(row.follower_count ?? 0),
    social_links: row.social_links
      ? (typeof row.social_links === "string" ? JSON.parse(row.social_links) : row.social_links)
      : null,
  }));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// === 获取待审核认证列表（管理员） ===

export async function getPendingVerifications(options: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 50);
  const offset = (page - 1) * limit;
  const status = options.status || "pending";

  const validStatuses = ["pending", "approved", "rejected", "all"];
  if (!validStatuses.includes(status)) {
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }

  // 获取总数
  let countQuery = db.selectFrom("users")
    .select((eb) => eb.fn.countAll().as("count"));
  if (status === "all") {
    countQuery = countQuery.where(sql<boolean>`verification_status != 'none'`);
  } else {
    countQuery = countQuery.where("verification_status", "=", status as any);
  }
  const countResult = await countQuery.executeTakeFirst();
  const total = Number(countResult?.count ?? 0);

  // 获取列表
  let mainQuery = db.selectFrom("users")
    .select((eb) => [
      "id", "name", "avatar", "email", "verification_status", "verification_applied_at",
      "verification_rejected_reason", "verification_real_name", "verification_id_type",
      "verification_id_number", "verification_portfolio_url", "brand_name", "brand_description",
      sql<number>`(SELECT COUNT(*) FROM images WHERE uploaded_by = users.id AND status = 'approved')`.as("img_count"),
    ]);
  if (status === "all") {
    mainQuery = mainQuery.where(sql<boolean>`verification_status != 'none'`);
  } else {
    mainQuery = mainQuery.where("verification_status", "=", status as any);
  }
  const rows = await mainQuery
    .orderBy("verification_applied_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  return {
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}