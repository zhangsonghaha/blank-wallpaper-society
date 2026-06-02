import { createChallenge, verifySolution, sha } from "altcha/lib";

// Altcha HMAC 签名密钥：优先 ALTCHA_HMAC_KEY，回退 AUTH_SECRET
const HMAC_SIGNATURE_SECRET: string =
  process.env.ALTCHA_HMAC_KEY || process.env.AUTH_SECRET || "";

// 如果没有配置签名密钥，在服务端启动时警告
if (!HMAC_SIGNATURE_SECRET) {
  console.warn("[Altcha] 警告：未配置 ALTCHA_HMAC_KEY 或 AUTH_SECRET，验证码签名不安全");
}

// 挑战有效期（毫秒），默认 10 分钟
const CHALLENGE_EXPIRY = 10 * 60 * 1000;

/**
 * Altcha v3 Challenge 接口（与 altcha-widget v3 兼容）
 */
export interface AltchaChallenge {
  parameters: {
    algorithm: string;
    nonce: string;
    salt: string;
    cost: number;
    keyLength: number;
    keyPrefix: string;
    expiresAt?: number;
  };
  signature?: string;
}

/**
 * Altcha v3 Payload 接口（客户端提交的验证数据）
 */
export interface AltchaPayload {
  challenge: {
    parameters: {
      algorithm: string;
      nonce: string;
      salt: string;
      cost: number;
      keyLength: number;
      keyPrefix: string;
      expiresAt?: number;
    };
    signature?: string;
  };
  solution: {
    counter: number;
    derivedKey: string;
    time?: number;
  };
}

/**
 * 生成 Altcha v3 挑战（使用 SHA-256 算法）
 * @returns v3 格式的 Challenge 对象
 */
export async function createAltchaChallenge(): Promise<AltchaChallenge> {
  const expiresAt = Date.now() + CHALLENGE_EXPIRY;

  const challenge = await createChallenge({
    algorithm: "SHA-256",
    cost: 5000,
    deriveKey: sha.deriveKey,
    hmacSignatureSecret: HMAC_SIGNATURE_SECRET,
    expiresAt,
  });

  // 在 parameters 中加入 expiresAt（用于客户端过期检测）
  if (challenge.parameters) {
    challenge.parameters.expiresAt = expiresAt;
  }

  return challenge as AltchaChallenge;
}

/**
 * 验证 Altcha v3 解决方案
 * 支持传入 Base64 编码的 JSON 字符串或已解析的对象
 * @returns 验证结果 { valid, error? }
 */
export async function verifyAltchaSolution(
  payload: AltchaPayload | string
): Promise<{ valid: boolean; error?: string }> {
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

  if (!parsed?.challenge || !parsed?.solution) {
    return { valid: false, error: "验证码数据不完整" };
  }

  // 检查过期
  const expiresAt = parsed.challenge.parameters?.expiresAt;
  if (expiresAt && Date.now() > expiresAt) {
    return { valid: false, error: "验证码已过期，请重新验证" };
  }

  try {
    const result = await verifySolution({
      challenge: parsed.challenge,
      deriveKey: sha.deriveKey,
      hmacSignatureSecret: HMAC_SIGNATURE_SECRET,
      solution: parsed.solution,
    });

    if (!result.verified) {
      if (result.expired) {
        return { valid: false, error: "验证码已过期，请重新验证" };
      }
      if (result.invalidSignature) {
        return { valid: false, error: "验证码签名无效，请重新验证" };
      }
      if (result.invalidSolution) {
        return { valid: false, error: "验证码校验失败，请重新验证" };
      }
      return { valid: false, error: "验证码验证失败，请重新验证" };
    }

    return { valid: true };
  } catch (err) {
    console.error("[Altcha] verifySolution error:", err);
    return { valid: false, error: "验证码验证失败，请重新验证" };
  }
}