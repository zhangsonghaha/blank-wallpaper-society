import mysql from "mysql2/promise";

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

/** 安全查询辅助函数：查询失败时返回默认值，不影响整体 */
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