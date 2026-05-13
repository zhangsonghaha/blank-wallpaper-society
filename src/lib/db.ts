import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
  port: 3306,
  user: "zhangsong",
  password: "zs15210265092!",
  database: "img",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: undefined,
});

export async function query(sql: string, params?: any[]) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;