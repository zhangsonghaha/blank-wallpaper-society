import mysql from "mysql2/promise";
import crypto from "crypto";

async function main() {
  const conn = await mysql.createConnection({
    host: "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
    port: 3306,
    user: "zhangsong",
    password: "zs15210265092!",
    database: "img",
  });

  // 创建 users 表
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL DEFAULT '',
      password VARCHAR(255) NOT NULL,
      avatar VARCHAR(500) DEFAULT NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ users 表创建成功");

  // 创建默认管理员
  const password = "admin123";
  const hash = crypto.createHash("sha256").update(password).digest("hex");

  const [rows] = await conn.execute("SELECT id FROM users WHERE email = ?", [
    "admin@img.com",
  ]);
  if (rows.length === 0) {
    await conn.execute(
      "INSERT INTO users (email, name, password, role) VALUES (?, ?, ?, ?)",
      ["admin@img.com", "管理员", hash, "admin"]
    );
    console.log("✅ 默认管理员创建成功 (admin@img.com / admin123)");
  } else {
    console.log("ℹ️ 管理员账号已存在");
  }

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});