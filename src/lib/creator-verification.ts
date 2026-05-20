/**
 * 创作者认证与品牌体系库
 * 提供认证申请、审核、品牌资料管理等核心功能
 */

import { query } from "@/lib/db";
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
  const rows = (await query(
    "SELECT verification_status FROM users WHERE id = ?",
    [userId]
  )) as any[];

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
  await query(
    `UPDATE users SET
      verification_status = 'pending',
      verification_applied_at = NOW(),
      verification_rejected_reason = NULL,
      verification_real_name = ?,
      verification_id_type = ?,
      verification_id_number = ?,
      verification_portfolio_url = ?,
      brand_name = COALESCE(?, brand_name),
      brand_description = COALESCE(?, brand_description)
    WHERE id = ?`,
    [
      data.real_name,
      data.id_type,
      data.id_number,
      data.portfolio_url,
      data.brand_name || null,
      data.brand_description || null,
      userId,
    ]
  );

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
  const rows = (await query(
    "SELECT verification_status, name FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (rows.length === 0) {
    return { success: false, message: "用户不存在" };
  }

  if (rows[0].verification_status !== "pending") {
    return { success: false, message: "该用户没有待审核的认证申请" };
  }

  if (action === "approve") {
    await query(
      `UPDATE users SET
        verification_status = 'approved',
        is_verified = 1,
        verified_at = NOW()
      WHERE id = ?`,
      [userId]
    );

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
    await query(
      `UPDATE users SET
        verification_status = 'rejected',
        verification_rejected_reason = ?,
        is_verified = 0
      WHERE id = ?`,
      [reason || null, userId]
    );

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
  const rows = (await query(
    `SELECT verification_status, is_verified, verified_at,
       verification_applied_at, verification_rejected_reason,
       brand_name, brand_description, brand_website, social_links
    FROM users WHERE id = ?`,
    [userId]
  )) as any[];

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    verification_status: row.verification_status || "none",
    is_verified: row.is_verified || 0,
    verified_at: row.verified_at,
    verification_applied_at: row.verification_applied_at,
    verification_rejected_reason: row.verification_rejected_reason,
    brand_name: row.brand_name,
    brand_description: row.brand_description,
    brand_website: row.brand_website,
    social_links: row.social_links
      ? typeof row.social_links === "string"
        ? JSON.parse(row.social_links)
        : row.social_links
      : null,
  };
}

// === 更新品牌资料（仅认证创作者可用） ===

export async function updateBrandProfile(
  userId: number,
  data: BrandProfile
): Promise<{ success: boolean; message: string }> {
  // 检查是否为认证创作者
  const rows = (await query(
    "SELECT is_verified, verification_status FROM users WHERE id = ?",
    [userId]
  )) as any[];

  if (rows.length === 0) {
    return { success: false, message: "用户不存在" };
  }

  if (rows[0].is_verified !== 1 && rows[0].verification_status !== "approved") {
    return { success: false, message: "仅认证创作者可更新品牌资料" };
  }

  await query(
    `UPDATE users SET
      brand_name = ?,
      brand_description = ?,
      brand_website = ?,
      social_links = ?
    WHERE id = ?`,
    [
      data.brand_name,
      data.brand_description || null,
      data.brand_website || null,
      data.social_links ? JSON.stringify(data.social_links) : null,
      userId,
    ]
  );

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

  const validSorts = ["verified_at", "images_count", "followers_count"];
  const sort = validSorts.includes(options.sort || "") ? options.sort : "verified_at";

  // 获取总数
  const countResult = (await query(
    "SELECT COUNT(*) as total FROM users WHERE is_verified = 1",
    []
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  // 获取列表
  let orderBy = "u.verified_at DESC";
  if (sort === "images_count") {
    orderBy = "img_count DESC";
  } else if (sort === "followers_count") {
    orderBy = "follower_count DESC";
  }

  const rows = (await query(
    `SELECT u.id, u.name, u.avatar, u.bio, u.brand_name, u.brand_description,
       u.brand_website, u.social_links, u.verified_at,
       (SELECT COUNT(*) FROM images WHERE user_id = u.id AND status = 'approved') as img_count,
       (SELECT COUNT(*) FROM user_follows WHERE following_id = u.id) as follower_count
    FROM users u
    WHERE u.is_verified = 1
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`,
    [limit, offset]
  )) as any[];

  // 解析 social_links JSON
  const data = rows.map((row: any) => ({
    ...row,
    social_links: row.social_links
      ? typeof row.social_links === "string"
        ? JSON.parse(row.social_links)
        : row.social_links
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

  const whereClause = status === "all" ? "verification_status != 'none'" : "verification_status = ?";

  // 获取总数
  const countResult = (await query(
    `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
    status === "all" ? [] : [status]
  )) as any[];
  const total = Number(countResult?.[0]?.total ?? 0);

  // 获取列表
  const rows = (await query(
    `SELECT id, name, avatar, email, verification_status, verification_applied_at,
       verification_rejected_reason, verification_real_name, verification_id_type,
       verification_id_number, verification_portfolio_url, brand_name, brand_description,
       (SELECT COUNT(*) FROM images WHERE uploaded_by = users.id AND status = 'approved') as img_count
    FROM users
    WHERE ${whereClause}
    ORDER BY verification_applied_at DESC
    LIMIT ? OFFSET ?`,
    [...(status === "all" ? [] : [status]), limit, offset]
  )) as any[];

  return {
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}