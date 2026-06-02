import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_ROUNDS = 12;

/**
 * 对明文密码进行哈希（bcrypt）
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 验证密码
 * 兼容旧 SHA-256 哈希：检测到旧格式后自动升级为 bcrypt
 * @returns { valid, upgradedHash? } — 如果验证通过且是旧哈希，返回升级后的 bcrypt 哈希
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; upgradedHash?: string }> {
  // 如果存储的哈希不是 bcrypt 格式（不以 $2 开头），则视为 SHA-256 旧哈希
  if (isLegacyHash(storedHash)) {
    const sha256Hash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");
    if (sha256Hash === storedHash) {
      // 自动升级为 bcrypt
      const upgradedHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      return { valid: true, upgradedHash };
    }
    return { valid: false };
  }

  // bcrypt 验证
  const valid = await bcrypt.compare(password, storedHash);
  return { valid };
}

/**
 * 检查哈希是否为旧版 SHA-256 格式
 * bcrypt 哈希以 $2a$、$2b$ 或 $2y$ 开头
 */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith("$2");
}
