/**
 * 结构化日志库
 * 基于 pino，提供统一的日志接口
 * 
 * 核心原则：
 * - 生产环境使用 JSON 结构化日志，方便日志收集和分析
 * - 开发环境使用易读的文本格式
 * - 支持子日志器（child），可附加上下文信息（如 requestId、userId）
 * - 自动附加环境信息（hostname、pid、环境变量）
 */

import pino from "pino";

// === 日志级别 ===
type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

// 获取日志级别（环境变量 > 默认值）
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel;
  if (envLevel && ["fatal", "error", "warn", "info", "debug", "trace"].includes(envLevel)) {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

// === 创建根日志器 ===
const rootLogger = pino({
  level: getLogLevel(),
  // 开发环境使用易读格式
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino/file", options: { destination: 1 } }  // stdout
    : undefined,
  // 基础字段
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || "development",
    service: "blank-wallpaper-society",
  },
  // 时间戳格式
  timestamp: pino.stdTimeFunctions.isoTime,
  // 格式化选项
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

// === 导出日志器 ===

/** 根日志器（直接使用） */
export const logger = rootLogger;

/**
 * 创建子日志器，附加上下文信息
 * 
 * @example
 * ```ts
 * const reqLogger = createLogger({ requestId: "abc123", userId: 42 });
 * reqLogger.info("处理请求");
 * // 输出: { requestId: "abc123", userId: 42, msg: "处理请求", ... }
 * ```
 */
export function createLogger(context: Record<string, any>) {
  return rootLogger.child(context);
}

// === 便捷方法（兼容 console.log 迁移） ===

/** 日志工具对象，提供与 console 类似的接口 */
export const log = {
  fatal: (msg: string, ...args: any[]) => rootLogger.fatal({ args }, msg),
  error: (msg: string, ...args: any[]) => rootLogger.error({ args }, msg),
  warn: (msg: string, ...args: any[]) => rootLogger.warn({ args }, msg),
  info: (msg: string, ...args: any[]) => rootLogger.info({ args }, msg),
  debug: (msg: string, ...args: any[]) => rootLogger.debug({ args }, msg),
  trace: (msg: string, ...args: any[]) => rootLogger.trace({ args }, msg),
};

export default rootLogger;