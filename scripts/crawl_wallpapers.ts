/**
 * 壁纸爬取脚本
 * 从 picsum.photos 爬取 100 张高质量壁纸
 * 上传到 MinIO 并记录到数据库
 *
 * 运行: npx tsx scripts/crawl_wallpapers.ts
 */

import mysql from "mysql2/promise";
import sharp from "sharp";
import { Client } from "minio";

// ============================================================
// 配置
// ============================================================

const MINIO_CONFIG = {
  endPoint: "82.157.176.188",
  port: 9000,
  useSSL: false,
  accessKey: "rustfsadmin",
  secretKey: "rustfsadmin",
};

const BUCKET_NAME = "image-gallery";
const PUBLIC_URL_BASE = "https://qq.qinqin.asia/storage";

const DB_CONFIG = {
  host: "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
  port: 3306,
  user: "zhangsong",
  password: "zs15210265092!",
  database: "img",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
};

// 壁纸分类及对应关键词
const CATEGORIES = [
  { id: "nature", label: "自然风光", keywords: ["nature", "landscape", "mountain", "forest", "sea", "lake", "sky"] },
  { id: "city", label: "城市建筑", keywords: ["city", "architecture", "building", "urban", "street"] },
  { id: "travel", label: "旅行", keywords: ["travel", "road", "adventure", "explore"] },
  { id: "art", label: "艺术", keywords: ["art", "abstract", "creative", "design"] },
  { id: "minimal", label: "极简", keywords: ["minimal", "simple", "clean", "geometry"] },
];

// 壁纸中文标题模板
const TITLE_TEMPLATES = [
  "绝美{category}壁纸",
  "{category}风光",
  "高清{category}摄影",
  "{category}精选",
  "{category}之美",
  "梦幻{category}",
  "{category}写意",
  "{category}大片",
  "极致{category}",
  "{category}壁纸精选",
];

const DESCRIPTION_TEMPLATES = [
  "一张精美的{category}主题壁纸，适合桌面和移动设备使用。",
  "高清画质的{category}壁纸，带来沉浸式的视觉体验。",
  "精选{category}摄影作品，细腻的画质展现每一个细节。",
  "令人惊叹的{category}风光，让你的屏幕焕然一新。",
  "高质量{category}壁纸，色彩丰富，细节清晰。",
];

// 壁纸尺寸配置
const WALLPAPER_SIZES: Array<{ width: number; height: number; label: string }> = [
  { width: 1920, height: 1080, label: "Full HD" },
  { width: 1920, height: 1200, label: "HD" },
  { width: 1920, height: 1280, label: "Widescreen" },
  { width: 2560, height: 1440, label: "2K" },
  { width: 2560, height: 1600, label: "WQXGA" },
  { width: 2880, height: 1800, label: "Retina" },
  { width: 3840, height: 2160, label: "4K" },
];

// 预定义的作者列表
const AUTHORS = [
  { name: "张摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhang" },
  { name: "李摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=li" },
  { name: "王摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=wang" },
  { name: "赵摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhao" },
  { name: "孙摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sun" },
  { name: "周摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=zhou" },
  { name: "吴摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=wu" },
  { name: "陈摄影师", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=chen" },
];

// ============================================================
// 工具函数
// ============================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 主逻辑
// ============================================================

async function main() {
  console.log("==============================================");
  console.log("  壁纸爬取脚本启动");
  console.log("  目标: 爬取 100 张壁纸 -> MinIO -> 数据库");
  console.log("==============================================\n");

  // 1. 初始化 MinIO 客户端
  console.log("[1/5] 连接 MinIO...");
  const minioClient = new Client(MINIO_CONFIG);
  // 检查 bucket 是否存在
  const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
  if (!bucketExists) {
    console.log(`  Bucket "${BUCKET_NAME}" 不存在，创建中...`);
    await minioClient.makeBucket(BUCKET_NAME);
  }
  console.log(`  MinIO 连接成功 (${MINIO_CONFIG.endPoint}:${MINIO_CONFIG.port})`);

  // 2. 连接数据库
  console.log("\n[2/5] 连接数据库...");
  const pool = mysql.createPool(DB_CONFIG);
  // 测试连接
  await pool.execute("SELECT 1");
  console.log("  数据库连接成功");

  // 3. 检查数据库中已有图片数量
  console.log("\n[3/5] 检查现有数据...");
  const [countResult] = await pool.execute("SELECT COUNT(*) as total FROM images");
  const existingCount = (countResult as any[])[0]?.total || 0;
  console.log(`  数据库中已有 ${existingCount} 张图片`);

  // 4. 生成爬取列表 - 使用 picsum.photos
  console.log("\n[4/5] 生成壁纸列表...");

  // picsum 可用 ID 范围 0-1084
  const TOTAL_WALLPAPERS = 100;
  const picsumIds = shuffleArray(Array.from({ length: 150 }, (_, i) => i + 1)).slice(0, TOTAL_WALLPAPERS);

  console.log(`  将爬取 ${TOTAL_WALLPAPERS} 张壁纸\n`);

  // 5. 开始爬取
  console.log("[5/5] 开始爬取并上传...\n");

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < picsumIds.length; i++) {
    const picsumId = picsumIds[i];

    // 随机选择一个壁纸尺寸
    const size = pickRandom(WALLPAPER_SIZES);
    const { width, height } = size;

    // 随机选择一个分类
    const category = pickRandom(CATEGORIES);
    const keyword = pickRandom(category.keywords);

    // picsum URL
    const imageUrl = `https://picsum.photos/id/${picsumId}/${width}/${height}`;

    // 生成标题和描述
    const titleTemplate = pickRandom(TITLE_TEMPLATES);
    const title = titleTemplate.replace("{category}", category.label);
    const descTemplate = pickRandom(DESCRIPTION_TEMPLATES);
    const description = descTemplate.replace("{category}", category.label);

    // 生成标签
    const tags = [category.id, keyword, ...pickRandom([
      ["wallpaper", "hd", "desktop"],
      ["background", "4k", "photography"],
      ["beautiful", "scenery", "high-resolution"],
      ["wallpaper", "nature", "landscape"],
    ])];

    // 选择作者
    const author = pickRandom(AUTHORS);

    // 生成文件名
    const filename = `wallpaper_${picsumId}_${width}x${height}.jpg`;
    const timestamp = Date.now() + i;
    const storageKey = `images/${timestamp}_${filename}`;

    const progress = `[${i + 1}/${TOTAL_WALLPAPERS}]`;

    try {
      process.stdout.write(`\r${progress} 下载中... ${imageUrl}`);

      // 下载图片
      const response = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WallpaperBot/1.0)" },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      // 检查图片是否有效
      let metadata: sharp.Metadata;
      try {
        metadata = await sharp(imageBuffer).metadata();
      } catch {
        throw new Error("无效的图片数据");
      }

      const actualWidth = metadata.width || width;
      const actualHeight = metadata.height || height;

      process.stdout.write(`\r${progress} 上传到 MinIO...`);

      // 上传到 MinIO
      await minioClient.putObject(
        BUCKET_NAME,
        storageKey,
        imageBuffer,
        imageBuffer.length,
        { "Content-Type": "image/jpeg" }
      );

      const url = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

      process.stdout.write(`\r${progress} 写入数据库...`);

      // 插入数据库
      await pool.execute(
        `INSERT INTO images 
          (title, description, filename, storage_key, url, width, height, file_size, mime_type, author, tags, category, status, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1)`,
        [
          title,
          description,
          filename,
          storageKey,
          url,
          actualWidth,
          actualHeight,
          imageBuffer.length,
          "image/jpeg",
          author.name,
          JSON.stringify(tags),
          category.id,
        ]
      );

      success++;
      console.log(`\r${progress} ✅ 成功 | ${title} | ${actualWidth}x${actualHeight} | ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    } catch (error: any) {
      failed++;
      console.error(`\r${progress} ❌ 失败 (ID=${picsumId}): ${error.message}`);
    }

    // 请求间隔，避免太快
    await sleep(300 + randomInt(0, 200));
  }

  // ============================================================
  // 完成
  // ============================================================

  console.log("\n\n==============================================");
  console.log("  爬取完成!");
  console.log("  ✅ 成功: " + success);
  console.log("  ❌ 失败: " + failed);
  console.log("  ⏭️  跳过: " + skipped);

  // 验证数据库记录
  const [finalCount] = await pool.execute("SELECT COUNT(*) as total FROM images");
  const totalCount = (finalCount as any[])[0]?.total || 0;
  console.log(`  数据库总记录数: ${totalCount}`);

  console.log("==============================================\n");

  await pool.end();
  console.log("数据库连接已关闭。");
}

main().catch((err) => {
  console.error("\n脚本执行出错:", err);
  process.exit(1);
});