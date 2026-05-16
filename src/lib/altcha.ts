import crypto from "crypto";

// Altcha HMAC 密钥：优先 ALTCHA_HMAC_KEY，回退 AUTH_SECRET
const HMAC_KEY = process.env.ALTCHA_HMAC_KEY || process.env.AUTH_SECRET || "altcha-default-secret-key";

// 挑战有效期（毫秒），默认 10 分钟
const CHALLENGE_EXPIRY = 10 * 60 * 1000;

/**
 * Altcha payload 接口
 */
export interface AltchaPayload {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
  took?: number;
}

/**
 * 生成 Altcha 挑战
 * salt 中嵌入时间戳以支持过期验证（altcha-widget 标准格式）
 */
export function createChallenge(): {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
} {
  // salt 格式：随机hex?t=时间戳（与 altcha-widget 兼容）
  const randomPart = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const salt = `${randomPart}?t=${timestamp}`;
  const number = Math.floor(Math.random() * 1e6);
  const algorithm = "SHA-256";

  // challenge = SHA-256(salt + number)
  const challenge = crypto
    .createHash("sha256")
    .update(salt + number)
    .digest("hex");

  // signature = HMAC-SHA256(key, challenge)
  const signature = crypto
    .createHmac("sha256", HMAC_KEY)
    .update(challenge)
    .digest("hex");

  return { algorithm, challenge, salt, signature };
}

/**
 * 验证 Altcha 解决方案
 * 支持传入 Base64 编码的 JSON 字符串或已解析的对象
 * @returns 验证结果 { valid, error? }
 */
export function verifySolution(payload: AltchaPayload | string): { valid: boolean; error?: string } {
  // 如果是字符串，先 Base64 解码为 JSON 对象
  let parsed: AltchaPayload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    } catch {
      return { valid: false, error: "验证码数据格式错误" };
    }
  } else {
    parsed = payload;
  }

  if (!parsed || !parsed.challenge || !parsed.salt || !parsed.signature || parsed.number === undefined) {
    return { valid: false, error: "验证码数据不完整" };
  }

  // 检查算法
  if (parsed.algorithm && parsed.algorithm !== "SHA-256") {
    return { valid: false, error: "不支持的算法" };
  }

  // 从 salt 中提取时间戳（altcha-widget salt 格式: hex?t=timestamp）
  const timestampMatch = parsed.salt.match(/[?&]t=(\d+)/);
  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[1], 10);
    if (Date.now() - timestamp > CHALLENGE_EXPIRY) {
      return { valid: false, error: "验证码已过期，请重新验证" };
    }
  }

  // 重新计算 challenge = SHA-256(salt + number)
  const computedChallenge = crypto
    .createHash("sha256")
    .update(parsed.salt + parsed.number)
    .digest("hex");

  // 验证 challenge 匹配
  if (computedChallenge !== parsed.challenge) {
    return { valid: false, error: "验证码校验失败，请重新验证" };
  }

  // 验证签名
  const computedSignature = crypto
    .createHmac("sha256", HMAC_KEY)
    .update(parsed.challenge)
    .digest("hex");

  if (computedSignature !== parsed.signature) {
    return { valid: false, error: "验证码签名无效，请重新验证" };
  }

  return { valid: true };
}