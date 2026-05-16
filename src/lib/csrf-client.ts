"use client";

let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;

/**
 * 获取 CSRF token
 * 优先从 NextAuth 内置端点 /api/auth/csrf 获取
 * 结果会被缓存，避免重复请求
 */
export async function getCsrfToken(): Promise<string | null> {
  // 如果已有缓存的 token，直接返回
  if (cachedToken) return cachedToken;

  // 如果正在请求中，复用同一个 Promise 避免并发重复请求
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const res = await fetch("/api/auth/csrf");
      if (res.ok) {
        const data = await res.json();
        if (data.csrfToken) {
          // NextAuth 返回的 csrfToken 格式为 "token|hash"
          // 服务端 validateCsrfToken 从 cookie 中取值后会 split("|")[0] 取前半部分
          // 因此客户端也需要只发送 token 部分，保持一致
          const token = (data.csrfToken as string).split("|")[0];
          cachedToken = token;
          return cachedToken;
        }
      }
    } catch {
      // 静默失败
    }
    return null;
  })();

  const result = await tokenPromise;
  tokenPromise = null;
  return result;
}

/**
 * 清除缓存的 CSRF token
 * 在用户登出或 session 变化时调用
 */
export function clearCsrfTokenCache(): void {
  cachedToken = null;
  tokenPromise = null;
}

/**
 * 为 fetch 请求添加 CSRF token 请求头
 * 用法：fetch(url, { ...options, ...withCsrfHeader() })
 */
export async function withCsrfHeader(): Promise<Record<string, string>> {
  const token = await getCsrfToken();
  if (token) {
    return { "x-csrf-token": token };
  }
  return {};
}