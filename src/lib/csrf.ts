import type { NextRequest } from "next/server";

/**
 * 从请求的 cookies 中提取 CSRF token
 * NextAuth v5 的 CSRF token 存储在 cookie 中，格式为 `token|hash`
 * 返回 token 部分（`|` 前半部分）
 */
export function getCsrfTokenFromCookies(request: NextRequest): string | null {
  // 检查 authjs.csrf-token（Auth.js v5 默认）
  const authjsToken = request.cookies.get("authjs.csrf-token")?.value;
  if (authjsToken) {
    const token = authjsToken.split("|")[0];
    if (token) return token;
  }

  // 检查 next-auth.csrf-token（兼容旧版本）
  const nextAuthToken = request.cookies.get("next-auth.csrf-token")?.value;
  if (nextAuthToken) {
    const token = nextAuthToken.split("|")[0];
    if (token) return token;
  }

  return null;
}

/**
 * 验证请求中的 CSRF token
 * 从请求头 x-csrf-token 中获取客户端发送的 token，
 * 与 cookie 中的 token 比对
 */
export function validateCsrfToken(request: NextRequest): { valid: boolean } {
  // 从请求头获取客户端发送的 CSRF token
  const headerToken = request.headers.get("x-csrf-token");
  if (!headerToken) {
    return { valid: false };
  }

  // 从 cookie 中获取 CSRF token
  const cookieToken = getCsrfTokenFromCookies(request);
  if (!cookieToken) {
    return { valid: false };
  }

  // 比对 token
  if (headerToken !== cookieToken) {
    return { valid: false };
  }

  return { valid: true };
}