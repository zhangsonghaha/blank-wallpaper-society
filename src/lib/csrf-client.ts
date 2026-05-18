"use client";

let cachedToken: string | null = null;
let tokenPromise: Promise<string | null> | null = null;
let lastFetchTime = 0;

// CSRF token 缓存有效期（5秒）
// NextAuth 可能在任何请求中重新生成 CSRF cookie，
// 缓存时间过长会导致 token 与 cookie 不匹配
const CSRF_TOKEN_TTL = 5000;

/**
 * 获取 CSRF token
 * 优先从 NextAuth 内置端点 /api/auth/csrf 获取
 * 结果会被短时间缓存，避免频繁请求但确保与 cookie 同步
 */
export async function getCsrfToken(): Promise<string | null> {
  // 如果缓存的 token 仍在有效期内，直接返回
  if (cachedToken && Date.now() - lastFetchTime < CSRF_TOKEN_TTL) {
    return cachedToken;
  }

  // 如果正在请求中，复用同一个 Promise 避免并发重复请求
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const res = await fetch("/api/auth/csrf");
      if (res.ok) {
        const data = await res.json();
        if (data.csrfToken) {
          // NextAuth /api/auth/csrf 端点返回的 csrfToken 就是纯 token 值
          // （不含 hash 后缀），无需再 split
          // 但为了兼容性，仍然处理可能包含 | 的情况
          const rawToken = data.csrfToken as string;
          const token = rawToken.includes("|") ? rawToken.split("|")[0] : rawToken;
          cachedToken = token;
          lastFetchTime = Date.now();
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
  lastFetchTime = 0;
}

/**
 * 为 fetch 请求添加 CSRF token 请求头
 * 用法：fetch(url, { ...options, ...await withCsrfHeader() })
 *
 * 每次调用都会重新获取 token（如果缓存过期），
 * 确保与服务端 cookie 同步
 */
export async function withCsrfHeader(): Promise<Record<string, string>> {
  const token = await getCsrfToken();
  if (token) {
    return { "x-csrf-token": token };
  }
  return {};
}