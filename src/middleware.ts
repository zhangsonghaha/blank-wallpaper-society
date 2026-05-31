import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";

// 从 Auth.js session cookie 中提取用户信息
// Auth.js v5 使用加密的 JWT，但我们可以通过 /api/auth/session 端点验证
// 中间件只做简单的 cookie 存在性检查和路径保护
// 详细的权限验证在 API 路由和服务端组件中完成

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const startTime = Date.now();

  // 检查是否存在 session cookie（任意一个）
  const sessionCookie =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  const hasSession = !!sessionCookie;

  // 保护管理后台 - 需要登录
  if (pathname.startsWith("/admin")) {
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // 注意：角色验证在 admin 页面服务端组件中完成
    // moderator 可以访问审核相关页面，admin 可以访问所有管理页面
    // 详细的 API 级别权限在各 route handler 中验证
  }

  // 保护上传页面 - 需要登录
  if (pathname.startsWith("/upload")) {
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // API v1 开放端点 - 支持API Key认证，跳过session检查（限流在route handler中处理）
  if (pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // API 路由保护
  if (pathname.startsWith("/api/")) {
    // CSRF 验证：对状态变更请求（POST/PUT/PATCH/DELETE）添加 CSRF 验证
    const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (mutatingMethods.includes(request.method)) {
      // 以下路径不需要 CSRF 验证
      // /api/auth/ — NextAuth 已自行处理
      // /api/v1/ — 使用 API Key 认证，无 Cookie
      // /api/upload — 使用 FormData，需要特殊处理
      const csrfExcludedPaths = [
        "/api/auth/",
        "/api/upload",
        "/api/auth/register",
        "/api/auth/forgot-password",
      ];
      // /api/v1/ 已在上面直接 return NextResponse.next()
      const needsCsrf = !csrfExcludedPaths.some((p) => pathname.startsWith(p));

      if (needsCsrf) {
        const csrfResult = validateCsrfToken(request);
        if (!csrfResult.valid) {
          console.warn(JSON.stringify({
            type: "csrf_validation_failed",
            path: pathname,
            method: request.method,
            reason: csrfResult.reason,
            hasHeader: !!request.headers.get("x-csrf-token"),
            timestamp: new Date().toISOString(),
          }));
          return NextResponse.json({ error: "CSRF验证失败" }, { status: 403 });
        }
      }
    }

    // 公开的 API
    const publicApis = [
      "/api/auth/",
      "/api/categories",
      "/api/images",
      "/api/posts",
      "/api/feed",
      "/api/proxy-image",
      "/api/health",
      "/api/search/",        // 搜索（热搜等）
      "/api/announcements",   // 公告列表
      "/api/daily-wallpaper", // 每日壁纸
      "/api/rankings",        // 排行榜
      "/api/discover/",       // 发现（主题专区/新鲜推荐）
      "/api/recommendations", // 推荐
      "/api/collections",     // 合集浏览（GET 公开，写操作在 route handler 验证）
      "/api/logs",            // 浏览/下载日志（公开追踪）
      "/api/user/level/",     // 用户等级查询（等级徽章展示，公开）
    ];

    // 管理员/审核员 API - 需要登录但在这里只检查 session，角色验证在 route handler 中
    const adminApis = [
      "/api/admin/review",
      "/api/admin/users",
      "/api/admin/stats",
      "/api/admin/notifications",
      "/api/admin/settings",
    ];

    // GET /api/images 公开
    if (pathname === "/api/images" && request.method === "GET") {
      return NextResponse.next();
    }
    // GET /api/images/[id] 公开
    if (pathname.startsWith("/api/images/") && request.method === "GET") {
      // 检查是否是 /api/images/[id] 格式
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length === 3 && segments[0] === "api" && segments[1] === "images") {
        return NextResponse.next();
      }
      // GET /api/images/[id]/comments 公开
      if (segments.length === 4 && segments[0] === "api" && segments[1] === "images" && segments[3] === "comments") {
        return NextResponse.next();
      }
    }

    // GET /api/posts 公开（POST 需要登录，在 route handler 中验证）
    if (pathname === "/api/posts" && request.method === "GET") {
      return NextResponse.next();
    }
    // GET /api/posts/[id] 和 GET /api/posts/[id]/comments 公开
    if (pathname.startsWith("/api/posts/") && request.method === "GET") {
      return NextResponse.next();
    }
    // GET /api/feed 公开
    if (pathname === "/api/feed" && request.method === "GET") {
      return NextResponse.next();
    }

    // GET /api/favorites 需要 session（用户个人收藏）
    // /api/collections GET 公开（合集浏览），POST/PUT/DELETE 在 route handler 验证
    // /api/collections/[id] GET 公开，POST/PUT/DELETE 在 route handler 验证
    if (pathname.startsWith("/api/collections/") && request.method === "GET") {
      return NextResponse.next();
    }

    const isPublic = publicApis.some((p) => pathname.startsWith(p));
    if (!isPublic && !hasSession) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
  }

  // === API 请求日志 ===
  if (pathname.startsWith("/api/")) {
    const duration = Date.now() - startTime;
    const method = request.method;
    // 跳过健康检查和 auth 回调的日志（太频繁）
    const skipLog = pathname === "/api/health" || pathname.startsWith("/api/auth/callback");
    if (!skipLog) {
      console.log(JSON.stringify({
        type: "api_request",
        method,
        path: pathname,
        duration,
        userAgent: request.headers.get("user-agent") || "",
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "",
        timestamp: new Date().toISOString(),
      }));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/upload/:path*", "/api/:path*"],
};