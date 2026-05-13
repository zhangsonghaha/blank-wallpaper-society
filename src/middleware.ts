import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 从 Auth.js session cookie 中提取用户信息
// Auth.js v5 使用加密的 JWT，但我们可以通过 /api/auth/session 端点验证
// 中间件只做简单的 cookie 存在性检查和路径保护
// 详细的权限验证在 API 路由和服务端组件中完成

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    // 这里只做基本的登录检查
  }

  // API 路由保护
  if (pathname.startsWith("/api/")) {
    // 公开的 API
    const publicApis = [
      "/api/auth/",
      "/api/categories",
      "/api/images",
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
    }

    const isPublic = publicApis.some((p) => pathname.startsWith(p));
    if (!isPublic && !hasSession) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};