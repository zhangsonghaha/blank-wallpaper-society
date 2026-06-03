import { Kysely, MysqlDialect } from "kysely";
import mysql from "mysql2/promise";
import type { DB } from "./db-types";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "img",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "15"),
  queueLimit: 0,
  ssl: undefined,
  connectTimeout: 10000,      // 连接超时10秒，避免长时间挂起
  idleTimeout: 60000,         // 空闲连接60秒后自动关闭（生产环境推荐）
  maxIdle: 5,                 // 最多保留5个空闲连接
  enableKeepAlive: true,      // 启用TCP keepAlive防止连接被断
  keepAliveInitialDelay: 10000,
});

// 可重试的连接错误码
const RETRYABLE_ERRORS = ["ETIMEDOUT", "ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE"];

// Kysely 实例 — 类型安全的查询入口
// 注意：Kysely 0.29.x 的 Plugin API 不支持 next 回调，重试逻辑由 safeExecute 和各兼容函数自行处理
export const db = new Kysely<DB>({
  dialect: new MysqlDialect({ pool: pool.pool }),
});

/**
 * 安全执行辅助函数 — 替代 safeQuery
 * 失败时返回默认值，不影响整体流程
 * 内置连接类错误自动重试一次
 */
export async function safeExecute<T>(
  queryFn: () => Promise<T>,
  fallback: T,
  label?: string
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await queryFn();
    } catch (error: any) {
      const code = error?.code || "";
      if (attempt === 0 && RETRYABLE_ERRORS.includes(code)) {
        console.warn(`safeExecute retry (${code}): ${label || "unknown"}`);
        continue;
      }
      console.warn(`safeExecute fallback (${label || "unknown"}):`, error);
      return fallback;
    }
  }
  return fallback;
}

// ── 兼容期：保留旧函数，迁移完成后删除 ──

export async function query(sql: string, params?: any[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (error: any) {
      const code = error?.code || "";
      if (attempt === 0 && RETRYABLE_ERRORS.includes(code)) {
        // 连接类错误，自动重试一次
        console.warn(`DB query retry (${code}): ${sql}`);
        continue;
      }
      console.error(`DB query error: ${sql}`, error);
      throw error;
    }
  }
}

export async function safeQuery(sql: string, params?: any[], defaultValue: any = []) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error: any) {
      const code = error?.code || "";
      if (attempt === 0 && RETRYABLE_ERRORS.includes(code)) {
        console.warn(`DB safeQuery retry (${code}): ${sql}`);
        continue;
      }
      console.warn(`DB safeQuery fallback (using default): ${sql}`, error);
      return defaultValue;
    }
  }
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
