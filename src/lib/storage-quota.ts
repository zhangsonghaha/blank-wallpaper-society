/**
 * 用户存储配额管理
 * 
 * 限制用户上传的总存储空间，防止滥用
 * 配额来源优先级：数据库 system_settings > 环境变量 > 默认值
 */

import { query } from "@/lib/db";

// === 默认配额配置（当数据库/环境变量未设置时使用） ===
const DEFAULT_QUOTA_MB = 500;       // 普通用户默认 500MB
const PREMIUM_QUOTA_MB = 2000;      // 付费用户 2000MB
const ADMIN_QUOTA_MB = 10000;       // 管理员 10GB

export interface StorageQuotaInfo {
  usedBytes: number;
  usedMB: number;
  quotaMB: number;
  quotaGB: number;
  usagePercent: number;
  remainingMB: number;
  isExceeded: boolean;
}

// 配额缓存（5分钟过期）
let quotaCache: { quotas: Record<string, number>; expiresAt: number } | null = null;
const QUOTA_CACHE_TTL = 5 * 60 * 1000;

/**
 * 从数据库获取各角色的配额配置
 * 设置键名：quota_default_mb / quota_premium_mb / quota_admin_mb
 */
async function getQuotaConfig(): Promise<Record<string, number>> {
  // 检查缓存
  if (quotaCache && Date.now() < quotaCache.expiresAt) {
    return quotaCache.quotas;
  }

  const defaults: Record<string, number> = {
    default: parseInt(process.env.QUOTA_DEFAULT_MB || String(DEFAULT_QUOTA_MB)),
    premium: parseInt(process.env.QUOTA_PREMIUM_MB || String(PREMIUM_QUOTA_MB)),
    moderator: parseInt(process.env.QUOTA_PREMIUM_MB || String(PREMIUM_QUOTA_MB)),
    admin: parseInt(process.env.QUOTA_ADMIN_MB || String(ADMIN_QUOTA_MB)),
  };

  try {
    const rows = (await query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?)",
      ["quota_default_mb", "quota_premium_mb", "quota_admin_mb"]
    )) as any[];
    for (const row of rows) {
      if (row.setting_value) {
        const mb = parseInt(row.setting_value);
        if (mb > 0) {
          if (row.setting_key === "quota_default_mb") defaults.default = mb;
          else if (row.setting_key === "quota_premium_mb") {
            defaults.premium = mb;
            defaults.moderator = mb;
          }
          else if (row.setting_key === "quota_admin_mb") defaults.admin = mb;
        }
      }
    }
  } catch {
    // 数据库不可用时使用默认值
  }

  quotaCache = { quotas: defaults, expiresAt: Date.now() + QUOTA_CACHE_TTL };
  return defaults;
}

/**
 * 清除配额缓存（管理后台修改设置后调用）
 */
export function clearQuotaCache(): void {
  quotaCache = null;
}

/**
 * 获取用户存储配额（MB）
 * 根据用户角色返回不同配额，优先从数据库读取
 */
async function getUserQuotaMB(role: string): Promise<number> {
  const quotas = await getQuotaConfig();
  return quotas[role] || quotas.default;
}

/**
 * 获取用户存储使用量（字节）
 */
export async function getUserStorageUsage(userId: number): Promise<number> {
  const result = (await query(
    "SELECT COALESCE(SUM(file_size), 0) as total_bytes FROM images WHERE uploaded_by = ?",
    [userId]
  )) as any[];

  return Number(result[0]?.total_bytes || 0);
}

/**
 * 检查用户存储配额
 * 返回配额详细信息
 */
export async function checkStorageQuota(userId: number, role: string): Promise<StorageQuotaInfo> {
  const usedBytes = await getUserStorageUsage(userId);
  const quotaMB = await getUserQuotaMB(role);
  const usedMB = Math.round(usedBytes / (1024 * 1024) * 100) / 100;
  const quotaBytes = quotaMB * 1024 * 1024;

  return {
    usedBytes,
    usedMB,
    quotaMB,
    quotaGB: Math.round(quotaMB / 1024 * 100) / 100,
    usagePercent: Math.round((usedBytes / quotaBytes) * 10000) / 100,
    remainingMB: Math.max(0, Math.round((quotaBytes - usedBytes) / (1024 * 1024) * 100) / 100),
    isExceeded: usedBytes >= quotaBytes,
  };
}

/**
 * 检查用户是否可以上传指定大小的文件
 * @returns { allowed: boolean, quotaInfo: StorageQuotaInfo }
 */
export async function canUpload(
  userId: number,
  role: string,
  fileSizeBytes: number
): Promise<{ allowed: boolean; quotaInfo: StorageQuotaInfo }> {
  const quotaInfo = await checkStorageQuota(userId, role);
  const quotaBytes = quotaInfo.quotaMB * 1024 * 1024;

  return {
    allowed: quotaInfo.usedBytes + fileSizeBytes <= quotaBytes,
    quotaInfo,
  };
}