import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 调整采样率
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // 设置采样率以分析用户会话行为
  replaysSessionSampleRate: 0.1,

  // 如果发生错误，则对整个会话进行采样
  replaysOnErrorSampleRate: 1.0,

  // 过滤敏感路径
  ignoreTransactions: [
    "/api/health",
  ],

  // 仅在生产环境启用
  enabled: process.env.NODE_ENV === "production",
});