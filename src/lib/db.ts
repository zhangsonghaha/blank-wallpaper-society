import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
  port: 3306,
  user: "zhangsong",
  password: "zs15210265092!",
  database: "img",
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
  ssl: undefined,
  idleTimeout: 30000,       // 空闲连接30秒后自动关闭
  maxIdle: 1,               // 最多保留1个空闲连接
  enableKeepAlive: true,     // 启用TCP keepAlive防止连接被断
  keepAliveInitialDelay: 10000,
});

export async function query(sql: string, params?: any[]) {
  try {
    const [rows] = await pool.execute(sql, params);
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