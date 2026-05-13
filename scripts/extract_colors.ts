/**
 * 批量颜色提取脚本
 * 为所有没有颜色信息的图片提取颜色
 * 运行: npx tsx scripts/extract_colors.ts
 */

import mysql from "mysql2/promise";
import sharp from "sharp";

// 数据库配置
const pool = mysql.createPool({
  host: "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
  port: 3306,
  user: "zhangsong",
  password: "zs15210265092!",
  database: "img",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

interface RGB {
  r: number;
  g: number;
  b: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
      .toUpperCase()
  );
}

function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
  );
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function kMeans(pixels: RGB[], k: number, maxIterations = 20): RGB[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;
  const centers: RGB[] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) centers.push({ ...pixels[i * step] });
  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => []);
    for (const pixel of pixels) {
      let minDist = Infinity, minIdx = 0;
      for (let i = 0; i < k; i++) {
        const dist = colorDistance(pixel, centers[i]);
        if (dist < minDist) { minDist = dist; minIdx = i; }
      }
      clusters[minIdx].push(pixel);
    }
    let changed = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      const nc: RGB = { r: 0, g: 0, b: 0 };
      for (const p of clusters[i]) { nc.r += p.r; nc.g += p.g; nc.b += p.b; }
      nc.r = Math.round(nc.r / clusters[i].length);
      nc.g = Math.round(nc.g / clusters[i].length);
      nc.b = Math.round(nc.b / clusters[i].length);
      if (nc.r !== centers[i].r || nc.g !== centers[i].g || nc.b !== centers[i].b) changed = true;
      centers[i] = nc;
    }
    if (!changed) break;
  }
  return centers;
}

function isVibrant(c: RGB): boolean {
  const brightness = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  return brightness > 15 && brightness < 240;
}

async function extractColors(buffer: Buffer): Promise<{ dominant: string; palette: string[] }> {
  const resizedBuffer = await sharp(buffer).resize(64, 64, { fit: "inside" }).raw().toBuffer();
  const meta = await sharp(resizedBuffer).metadata();
  const w = meta.width || 64, h = meta.height || 64;
  const pixels: RGB[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      pixels.push({ r: resizedBuffer[idx], g: resizedBuffer[idx + 1], b: resizedBuffer[idx + 2] });
    }
  }
  const centers = kMeans(pixels, 8);
  const clusterCounts = centers.map((center) => ({ center, count: 0 }));
  for (const pixel of pixels) {
    let minDist = Infinity, minIdx = 0;
    for (let i = 0; i < centers.length; i++) {
      const dist = colorDistance(pixel, centers[i]);
      if (dist < minDist) { minDist = dist; minIdx = i; }
    }
    clusterCounts[minIdx].count++;
  }
  clusterCounts.sort((a, b) => b.count - a.count);
  let dominant: RGB | null = null;
  for (const item of clusterCounts) { if (isVibrant(item.center)) { dominant = item.center; break; } }
  if (!dominant) dominant = clusterCounts[0]?.center || { r: 128, g: 128, b: 128 };
  const palette: string[] = [];
  for (const item of clusterCounts) {
    if (palette.length >= 5) break;
    const hex = rgbToHex(item.center.r, item.center.g, item.center.b);
    let tooClose = false;
    for (const eh of palette) { if (colorDistance(item.center, hexToRgb(eh)) < 40) { tooClose = true; break; } }
    if (!tooClose) palette.push(hex);
  }
  return { dominant: rgbToHex(dominant.r, dominant.g, dominant.b), palette: palette.slice(0, 5) };
}

async function main() {
  console.log("开始批量提取颜色...");

  // 查询所有没有颜色信息的图片
  const [rows] = await pool.execute(
    "SELECT id, url FROM images WHERE dominant_color IS NULL OR dominant_color = ''"
  );
  const images = rows as any[];
  console.log(`找到 ${images.length} 张需要提取颜色的图片`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      process.stdout.write(`\r[${i + 1}/${images.length}] 处理图片 ID=${img.id}...`);

      // 下载图片
      const response = await fetch(img.url);
      if (!response.ok) throw new Error(`下载失败: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 提取颜色
      const { dominant, palette } = await extractColors(buffer);

      // 更新数据库
      await pool.execute(
        "UPDATE images SET dominant_color = ?, color_palette = ? WHERE id = ?",
        [dominant, JSON.stringify(palette), img.id]
      );

      success++;
    } catch (error: any) {
      failed++;
      console.error(`\n图片 ID=${img.id} 处理失败: ${error.message}`);
    }

    // 避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\n\n批量提取完成! 成功: ${success}, 失败: ${failed}`);
  await pool.end();
}

main().catch(console.error);