import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "zhangsong",
  password: process.env.DB_PASSWORD || "zs15210265092!",
  database: process.env.DB_NAME || "img",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "15"),
  queueLimit: 0,
  ssl: undefined,
  idleTimeout: 60000,       // 空闲连接60秒后自动关闭（生产环境推荐）
  maxIdle: 5,               // 最多保留5个空闲连接
  enableKeepAlive: true,     // 启用TCP keepAlive防止连接被断
  keepAliveInitialDelay: 10000,
});

export async function query(sql: string, params?: any[]) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`DB query error: ${sql}`, error);
    throw error;
  }
}

/** 安全查询辅助函数：查询失败时返回默认值，不影响整体 */
export async function safeQuery(sql: string, params?: any[], defaultValue: any = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.warn(`DB safeQuery fallback (using default): ${sql}`, error);
    return defaultValue;
  }
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;