/**
 * 初始化脚本：创建 MinIO 桶 和 MySQL 数据库表
 * 运行: node scripts/init-storage.mjs
 */

import { Client as MinioClient } from "minio";
import mysql from "mysql2/promise";

// ===== MinIO 配置 =====
const MINIO_CONFIG = {
  endPoint: "82.157.176.188",
  port: 9000,
  useSSL: false,
  accessKey: "rustfsadmin",
  secretKey: "rustfsadmin",
};

const BUCKET_NAME = "image-gallery";
const PUBLIC_URL = "https://qq.qinqin.asia/storage";

// ===== MySQL 配置 =====
const DB_CONFIG = {
  host: "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
  port: 3306,
  user: "zhangsong",
  password: "zs15210265092!",
  database: "img",
  ssl: false,
};

async function initMinio() {
  console.log("\n📦 连接 MinIO...");
  const minio = new MinioClient(MINIO_CONFIG);

  // 检查桶是否存在
  const exists = await minio.bucketExists(BUCKET_NAME);
  if (exists) {
    console.log(`  ✅ 桶 "${BUCKET_NAME}" 已存在`);
  } else {
    await minio.makeBucket(BUCKET_NAME, "us-east-1");
    console.log(`  ✅ 桶 "${BUCKET_NAME}" 创建成功`);

    // 设置公开读取策略
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        },
      ],
    };
    await minio.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    console.log(`  ✅ 桶 "${BUCKET_NAME}" 已设置为公开读取`);
  }

  return minio;
}

async function initDatabase() {
  console.log("\n🗄️ 连接 MySQL...");
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log("  ✅ 数据库连接成功");

  // 创建图片表
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL DEFAULT '' COMMENT '图片标题',
      description TEXT COMMENT '图片描述',
      filename VARCHAR(500) NOT NULL COMMENT '原始文件名',
      storage_key VARCHAR(500) NOT NULL COMMENT '对象存储路径',
      url VARCHAR(1000) NOT NULL COMMENT '公开访问URL',
      thumbnail_url VARCHAR(1000) COMMENT '缩略图URL',
      width INT DEFAULT 0 COMMENT '图片宽度',
      height INT DEFAULT 0 COMMENT '图片高度',
      file_size BIGINT DEFAULT 0 COMMENT '文件大小(字节)',
      mime_type VARCHAR(100) DEFAULT 'image/jpeg' COMMENT '文件类型',
      author VARCHAR(255) DEFAULT '' COMMENT '作者',
      tags VARCHAR(500) DEFAULT '' COMMENT '标签(逗号分隔)',
      category VARCHAR(100) DEFAULT '' COMMENT '分类',
      is_favorite TINYINT(1) DEFAULT 0 COMMENT '是否收藏',
      view_count INT DEFAULT 0 COMMENT '浏览次数',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_category (category),
      INDEX idx_created_at (created_at),
      INDEX idx_is_favorite (is_favorite)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片表'
  `);
  console.log("  ✅ 数据表 `images` 创建/确认成功");

  // 创建分类表
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL COMMENT '分类名称',
      slug VARCHAR(100) NOT NULL UNIQUE COMMENT '分类标识',
      sort_order INT DEFAULT 0 COMMENT '排序',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分类表'
  `);
  console.log("  ✅ 数据表 `categories` 创建/确认成功");

  // 插入默认分类
  const defaultCategories = [
    { name: "自然风光", slug: "nature", sort: 1 },
    { name: "城市建筑", slug: "city", sort: 2 },
    { name: "人像摄影", slug: "portrait", sort: 3 },
    { name: "美食", slug: "food", sort: 4 },
    { name: "旅行", slug: "travel", sort: 5 },
    { name: "艺术", slug: "art", sort: 6 },
    { name: "动物", slug: "animals", sort: 7 },
    { name: "极简", slug: "minimal", sort: 8 },
  ];

  for (const cat of defaultCategories) {
    await conn.execute(
      `INSERT IGNORE INTO categories (name, slug, sort_order) VALUES (?, ?, ?)`,
      [cat.name, cat.slug, cat.sort]
    );
  }
  console.log("  ✅ 默认分类已插入");

  await conn.end();
  console.log("  ✅ 数据库初始化完成\n");
}

async function main() {
  console.log("========================================");
  console.log("🚀 初始化存储系统");
  console.log("========================================");

  try {
    await initMinio();
  } catch (err) {
    console.error("  ❌ MinIO 初始化失败:", err.message);
  }

  try {
    await initDatabase();
  } catch (err) {
    console.error("  ❌ 数据库初始化失败:", err.message);
  }

  console.log("========================================\n");
}

main().catch(console.error);