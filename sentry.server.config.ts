import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 调整采样率
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // 过滤敏感路径
  ignoreTransactions: [
    "/api/health",
  ],

  // 仅在生产环境启用
  enabled: process.env.NODE_ENV === "production",
});