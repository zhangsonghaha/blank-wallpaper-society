import sharp from "sharp";

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface ColorExtractResult {
  dominant: string;
  palette: string[];
}

/**
 * RGB转HEX
 */
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

/**
 * 计算两个颜色之间的欧几里得距离
 */
export function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * 将HEX颜色转为RGB
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * 简易K-means聚类算法，将像素颜色分为k组
 */
function kMeans(
  pixels: RGB[],
  k: number,
  maxIterations: number = 20
): RGB[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;

  // 随机选取初始中心点
  const centers: RGB[] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centers.push({ ...pixels[i * step] });
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配每个像素到最近的中心
    const clusters: RGB[][] = Array.from({ length: k }, () => []);
    for (const pixel of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < k; i++) {
        const dist = colorDistance(pixel, centers[i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      clusters[minIdx].push(pixel);
    }

    // 更新中心点
    let changed = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      const newCenter: RGB = {
        r: 0,
        g: 0,
        b: 0,
      };
      for (const p of clusters[i]) {
        newCenter.r += p.r;
        newCenter.g += p.g;
        newCenter.b += p.b;
      }
      newCenter.r = Math.round(newCenter.r / clusters[i].length);
      newCenter.g = Math.round(newCenter.g / clusters[i].length);
      newCenter.b = Math.round(newCenter.b / clusters[i].length);

      if (
        newCenter.r !== centers[i].r ||
        newCenter.g !== centers[i].g ||
        newCenter.b !== centers[i].b
      ) {
        changed = true;
      }
      centers[i] = newCenter;
    }

    if (!changed) break;
  }

  return centers;
}

/**
 * 判断颜色是否太接近黑或白（过于暗淡的颜色不利于搜索展示）
 */
function isVibrant(c: RGB): boolean {
  const brightness = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  return brightness > 15 && brightness < 240;
}

/**
 * 从图片Buffer中提取主色调和调色板
 * 算法：缩小图片 -> 采样像素 -> K-means聚类 -> 按频率排序取Top5
 * 如果Sharp处理失败，使用基于buffer采样的备用方案
 */
export async function extractColors(
  imageBuffer: Buffer
): Promise<ColorExtractResult> {
  try {
    // 将图片缩小到小尺寸以提高处理速度
    const resizedBuffer = await sharp(imageBuffer)
      .resize(64, 64, { fit: "inside" })
      .raw()
      .toBuffer();

    const meta = await sharp(resizedBuffer).metadata();
    const w = meta.width || 64;
    const h = meta.height || 64;

    // 采样像素
    const pixels: RGB[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 3;
        pixels.push({
          r: resizedBuffer[idx],
          g: resizedBuffer[idx + 1],
          b: resizedBuffer[idx + 2],
        });
      }
    }

    // 使用K-means将像素分为8组
    const k = 8;
    const centers = kMeans(pixels, k);

    // 计算每个聚类中心的像素数量
    const clusterCounts: { center: RGB; count: number }[] = centers.map(
      (center) => ({
        center,
        count: 0,
      })
    );

    for (const pixel of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < centers.length; i++) {
        const dist = colorDistance(pixel, centers[i]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      clusterCounts[minIdx].count++;
    }

    // 按像素数量降序排序
    clusterCounts.sort((a, b) => b.count - a.count);

    // 优先选择鲜艳的颜色作为主色调
    let dominant: RGB | null = null;
    for (const item of clusterCounts) {
      if (isVibrant(item.center)) {
        dominant = item.center;
        break;
      }
    }
    // 如果没有鲜艳颜色，取最频繁的
    if (!dominant) {
      dominant = clusterCounts[0]?.center || { r: 128, g: 128, b: 128 };
    }

    // 构建调色板（最多5个颜色，去除过于相似的颜色）
    const palette: string[] = [];
    const minColorDistance = 40; // 颜色间最小距离

    for (const item of clusterCounts) {
      if (palette.length >= 5) break;
      const hex = rgbToHex(item.center.r, item.center.g, item.center.b);

      // 检查与已有调色板颜色的距离
      const rgb = item.center;
      let tooClose = false;
      for (const existingHex of palette) {
        const existingRgb = hexToRgb(existingHex);
        if (colorDistance(rgb, existingRgb) < minColorDistance) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        palette.push(hex);
      }
    }

    // 如果调色板不足5个，补上剩余的
    if (palette.length < 5) {
      for (const item of clusterCounts) {
        if (palette.length >= 5) break;
        const hex = rgbToHex(item.center.r, item.center.g, item.center.b);
        if (!palette.includes(hex)) {
          palette.push(hex);
        }
      }
    }

    return {
      dominant: rgbToHex(dominant.r, dominant.g, dominant.b),
      palette: palette.slice(0, 5),
    };
  } catch (error) {
    // Sharp处理失败时，使用基于buffer采样的备用方案
    console.warn("Sharp颜色提取失败，使用备用采样方案:", error);
    return extractColorsFallback(imageBuffer);
  }
}

/**
 * 备用颜色提取方案：直接从buffer中均匀采样像素
 */
function extractColorsFallback(imageBuffer: Buffer): ColorExtractResult {
  const len = imageBuffer.length;
  // 从buffer中均匀采样像素（每隔一定字节取3个作为RGB）
  const sampleCount = 100;
  const step = Math.max(3, Math.floor(len / sampleCount));
  const pixels: RGB[] = [];

  for (let i = 0; i < len - 2 && pixels.length < sampleCount; i += step) {
    pixels.push({
      r: imageBuffer[i],
      g: imageBuffer[i + 1],
      b: imageBuffer[i + 2],
    });
  }

  if (pixels.length === 0) {
    return { dominant: "#808080", palette: ["#808080"] };
  }

  const centers = kMeans(pixels, 5);
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

  const dominant = clusterCounts[0]?.center || { r: 128, g: 128, b: 128 };
  const palette = clusterCounts
    .slice(0, 5)
    .map((c) => rgbToHex(c.center.r, c.center.g, c.center.b));

  return {
    dominant: rgbToHex(dominant.r, dominant.g, dominant.b),
    palette,
  };
}

/**
 * 计算两个HEX颜色之间的色差
 */
export function hexColorDistance(hex1: string, hex2: string): number {
  return colorDistance(hexToRgb(hex1), hexToRgb(hex2));
}