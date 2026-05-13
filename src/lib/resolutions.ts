/**
 * 壁纸分辨率定义
 */

export interface Resolution {
  width: number;
  height: number;
  label: string;
  category: "phone" | "desktop" | "tablet";
}

export const RESOLUTIONS: Resolution[] = [
  // 手机
  { width: 1080, height: 1920, label: "1080×1920", category: "phone" },
  { width: 1440, height: 2560, label: "1440×2560", category: "phone" },
  // 桌面
  { width: 1920, height: 1080, label: "1920×1080", category: "desktop" },
  { width: 2560, height: 1440, label: "2560×1440", category: "desktop" },
  { width: 3840, height: 2160, label: "3840×2160", category: "desktop" },
  // 平板
  { width: 2048, height: 2732, label: "2048×2732", category: "tablet" },
];

export const RESOLUTION_MAP = new Map(
  RESOLUTIONS.map((r) => [`${r.width}x${r.height}`, r])
);

export const CATEGORY_LABELS: Record<Resolution["category"], string> = {
  phone: "手机",
  desktop: "桌面",
  tablet: "平板",
};

/**
 * 根据用户屏幕尺寸推荐最佳分辨率
 */
export function getRecommendedResolution(
  screenWidth: number,
  screenHeight: number
): Resolution | null {
  const screenPixels = screenWidth * screenHeight;
  let best: Resolution | null = null;
  let bestDiff = Infinity;

  for (const res of RESOLUTIONS) {
    const resPixels = res.width * res.height;
    const diff = Math.abs(resPixels - screenPixels);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = res;
    }
  }

  return best;
}

/**
 * 生成缩放图的MinIO存储key
 */
export function getResizedKey(
  originalKey: string,
  width: number,
  height: number
): string {
  const lastDot = originalKey.lastIndexOf(".");
  const baseKey =
    lastDot !== -1 ? originalKey.substring(0, lastDot) : originalKey;
  return `${baseKey}_${width}x${height}.webp`;
}