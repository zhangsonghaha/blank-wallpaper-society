import type { NextRequest } from "next/server";

/**
 * 从请求的 cookies 中提取 CSRF token
 * NextAuth v5 的 CSRF token 存储在 cookie 中，格式为 `token|hash`
 * 返回 token 部分（`|` 前半部分）
 *
 * 支持的 cookie 名称（按优先级）：
 * 1. __Host-authjs.csrf-token — HTTPS 环境下 Auth.js v5 默认
 * 2. authjs.csrf-token — HTTP 环境下 Auth.js v5 默认
 * 3. __Host-next-auth.csrf-token — HTTPS 环境下兼容旧版本
 * 4. next-auth.csrf-token — HTTP 环境下兼容旧版本
 */
export function getCsrfTokenFromCookies(request: NextRequest): string | null {
  const cookieNames = [
    "__Host-authjs.csrf-token",
    "authjs.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.csrf-token",
  ];

  for (const name of cookieNames) {
    const cookieValue = request.cookies.get(name)?.value;
    if (cookieValue) {
      const token = cookieValue.split("|")[0];
      if (token) return token;
    }
  }

  return null;
}

/**
 * 验证请求中的 CSRF token
 * 从请求头 x-csrf-token 中获取客户端发送的 token，
 * 与 cookie 中的 token 比对
 *
 * 采用 Double Submit Cookie 模式：
 * 客户端从 /api/auth/csrf 获取 token，通过请求头发送，
 * 服务端从 cookie 中提取 token 进行比对
 */
export function validateCsrfToken(request: NextRequest): { valid: boolean; reason?: string } {
  // 从请求头获取客户端发送的 CSRF token
  const headerToken = request.headers.get("x-csrf-token");
  if (!headerToken) {
    return { valid: false, reason: "missing_header" };
  }

  // 从 cookie 中获取 CSRF token
  const cookieToken = getCsrfTokenFromCookies(request);
  if (!cookieToken) {
    return { valid: false, reason: "missing_cookie" };
  }

  // 比对 token（使用时间安全比较防止时序攻击）
  if (!timingSafeEqual(headerToken, cookieToken)) {
    return { valid: false, reason: "token_mismatch" };
  }

  return { valid: true };
}

/**
 * 时间安全的字符串比较，防止时序攻击
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}