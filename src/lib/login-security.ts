import { NextRequest } from "next/server";

// ========== 登录失败锁定 ==========
const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 分钟

interface LoginFailEntry {
  count: number;
  lockedUntil: number | null; // 锁定到期时间戳（ms）
}

const loginFailStore = new Map<string, LoginFailEntry>();

// ========== 登录 IP 限流 ==========
const LOGIN_IP_RATE_LIMIT = 5; // 每分钟最多 5 次
const LOGIN_IP_RATE_WINDOW = 60 * 1000; // 1 分钟

interface IpRateEntry {
  count: number;
  resetAt: number; // 窗口到期时间戳（ms）
}

const loginIpRateStore = new Map<string, IpRateEntry>();

// ========== 忘记密码 IP 限流 ==========
const FORGOT_PW_RATE_LIMIT = 5; // 每小时最多 5 次
const FORGOT_PW_RATE_WINDOW = 60 * 60 * 1000; // 1 小时

const forgotPwRateStore = new Map<string, IpRateEntry>();

// ========== 定时清理过期条目 ==========
if (typeof globalThis !== "undefined") {
  const cleanInterval = setInterval(() => {
    const now = Date.now();

    // 清理登录失败记录
    for (const [key, entry] of loginFailStore) {
      if (entry.lockedUntil && now > entry.lockedUntil) {
        loginFailStore.delete(key);
      }
    }

    // 清理登录 IP 限流
    for (const [key, entry] of loginIpRateStore) {
      if (now > entry.resetAt) {
        loginIpRateStore.delete(key);
      }
    }

    // 清理忘记密码 IP 限流
    for (const [key, entry] of forgotPwRateStore) {
      if (now > entry.resetAt) {
        forgotPwRateStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  // 防止 Node.js 进程因定时器不退出
  if (cleanInterval && typeof cleanInterval === "object" && "unref" in cleanInterval) {
    (cleanInterval as NodeJS.Timeout).unref();
  }
}

// ========== IP 获取 ==========

/**
 * 从请求中获取客户端 IP
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  // NextRequest 的 geo 或 connection 信息
  return "unknown";
}

// ========== 登录失败锁定 ==========

/**
 * 检查邮箱是否被锁定
 */
export function checkLoginLock(email: string): { locked: boolean; remainingSeconds: number } {
  const key = `loginFail:${email.toLowerCase()}`;
  const entry = loginFailStore.get(key);

  if (!entry || !entry.lockedUntil) {
    return { locked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now < entry.lockedUntil) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { locked: true, remainingSeconds };
  }

  // 锁定已过期，清除记录
  loginFailStore.delete(key);
  return { locked: false, remainingSeconds: 0 };
}

/**
 * 记录登录失败
 */
export function recordLoginFailure(email: string): { locked: boolean; remainingSeconds: number } {
  const key = `loginFail:${email.toLowerCase()}`;
  const entry = loginFailStore.get(key) || { count: 0, lockedUntil: null };

  entry.count += 1;

  if (entry.count >= MAX_LOGIN_FAILURES) {
    entry.lockedUntil = Date.now() + LOCK_DURATION;
  }

  loginFailStore.set(key, entry);

  if (entry.lockedUntil) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { locked: true, remainingSeconds };
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * 登录成功后清除失败记录
 */
export function clearLoginFailures(email: string): void {
  const key = `loginFail:${email.toLowerCase()}`;
  loginFailStore.delete(key);
}

// ========== 登录 IP 限流 ==========

/**
 * 检查登录 IP 限流
 */
export function checkLoginIpRate(ip: string): { allowed: boolean; remainingSeconds: number } {
  const key = `loginIpRate:${ip}`;
  const now = Date.now();
  const entry = loginIpRateStore.get(key);

  if (!entry || now > entry.resetAt) {
    // 无记录或窗口已过期，允许
    return { allowed: true, remainingSeconds: 0 };
  }

  if (entry.count >= LOGIN_IP_RATE_LIMIT) {
    const remainingSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * 记录登录 IP 请求
 */
export function recordLoginIpAttempt(ip: string): void {
  const key = `loginIpRate:${ip}`;
  const now = Date.now();
  const entry = loginIpRateStore.get(key);

  if (!entry || now > entry.resetAt) {
    // 新窗口
    loginIpRateStore.set(key, {
      count: 1,
      resetAt: now + LOGIN_IP_RATE_WINDOW,
    });
  } else {
    entry.count += 1;
  }
}

// ========== 忘记密码 IP 限流 ==========

/**
 * 检查忘记密码 IP 限流
 */
export function checkForgotPasswordRate(ip: string): { allowed: boolean; remainingSeconds: number } {
  const key = `forgotPwRate:${ip}`;
  const now = Date.now();
  const entry = forgotPwRateStore.get(key);

  if (!entry || now > entry.resetAt) {
    return { allowed: true, remainingSeconds: 0 };
  }

  if (entry.count >= FORGOT_PW_RATE_LIMIT) {
    const remainingSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true, remainingSeconds: 0 };
}

/**
 * 记录忘记密码请求
 */
export function recordForgotPasswordAttempt(ip: string): void {
  const key = `forgotPwRate:${ip}`;
  const now = Date.now();
  const entry = forgotPwRateStore.get(key);

  if (!entry || now > entry.resetAt) {
    forgotPwRateStore.set(key, {
      count: 1,
      resetAt: now + FORGOT_PW_RATE_WINDOW,
    });
  } else {
    entry.count += 1;
  }
}