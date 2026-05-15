import sharp from "sharp";
import { putBuffer, getPublicUrl } from "@/lib/minio";

// ===== 变体配置 =====

export interface VariantConfig {
  name: string;
  maxWidth: number | null;
  maxHeight: number | null;
  quality: number | null;
  format: string | null; // null 表示保留原格式
}

export interface ThumbnailConfig {
  name: string;
  width: number;
  height: number;
  fit: "cover" | "inside" | "outside";
  format: string;
  quality: number;
}

export const VARIANTS: VariantConfig[] = [
  { name: "mobile", maxWidth: 1080, maxHeight: 1920, quality: 85, format: "webp" },
  { name: "desktop", maxWidth: 1920, maxHeight: 1080, quality: 90, format: "webp" },
  { name: "tablet", maxWidth: 1536, maxHeight: 2048, quality: 85, format: "webp" },
  { name: "ultrawide", maxWidth: 3440, maxHeight: 1440, quality: 90, format: "webp" },
  { name: "original", maxWidth: null, maxHeight: null, quality: null, format: null },
];

export const THUMBNAILS: ThumbnailConfig[] = [
  { name: "thumb_sm", width: 200, height: 200, fit: "cover", format: "webp", quality: 70 },
  { name: "thumb_md", width: 400, height: 400, fit: "inside", format: "webp", quality: 80 },
  { name: "thumb_lg", width: 800, height: 600, fit: "inside", format: "webp", quality: 85 },
];

// ===== 结果接口 =====

export interface VariantResult {
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ThumbnailResult {
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface VariantInfo {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface ThumbnailInfo {
  url: string;
  width: number;
  height: number;
  size: number;
}

// ===== 核心生成函数 =====

/**
 * 计算变体的目标尺寸，保持宽高比
 */
function calculateTargetSize(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number | null,
  maxHeight: number | null
): { width: number; height: number } {
  if (maxWidth === null && maxHeight === null) {
    return { width: originalWidth, height: originalHeight };
  }

  let targetWidth = originalWidth;
  let targetHeight = originalHeight;

  if (maxWidth !== null && targetWidth > maxWidth) {
    const ratio = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = Math.round(targetHeight * ratio);
  }

  if (maxHeight !== null && targetHeight > maxHeight) {
    const ratio = maxHeight / targetHeight;
    targetHeight = maxHeight;
    targetWidth = Math.round(targetWidth * ratio);
  }

  return { width: targetWidth, height: targetHeight };
}

/**
 * 生成指定分辨率的变体
 * 仅当原图尺寸大于变体最大尺寸时才缩小，否则跳过该变体
 */
export async function generateVariants(
  buffer: Buffer,
  originalWidth: number,
  originalHeight: number
): Promise<VariantResult[]> {
  const results: VariantResult[] = [];

  for (const variant of VARIANTS) {
    // original 变体：直接使用原图信息
    if (variant.name === "original") {
      results.push({
        name: variant.name,
        buffer,
        width: originalWidth,
        height: originalHeight,
        format: "original",
        size: buffer.length,
      });
      continue;
    }

    const { width: targetWidth, height: targetHeight } = calculateTargetSize(
      originalWidth,
      originalHeight,
      variant.maxWidth,
      variant.maxHeight
    );

    // 如果目标尺寸和原图一样或更大，跳过（不需要缩小）
    if (targetWidth >= originalWidth && targetHeight >= originalHeight) {
      continue;
    }

    try {
      const pipeline = sharp(buffer).resize(targetWidth, targetHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });

      // 转换格式
      if (variant.format === "webp") {
        pipeline.webp({ quality: variant.quality || 90 });
      }

      const outputBuffer = await pipeline.toBuffer();
      const metadata = await sharp(outputBuffer).metadata();

      results.push({
        name: variant.name,
        buffer: outputBuffer,
        width: metadata.width || targetWidth,
        height: metadata.height || targetHeight,
        format: variant.format || "original",
        size: outputBuffer.length,
      });
    } catch (err) {
      console.error(`生成变体 ${variant.name} 失败:`, err);
    }
  }

  return results;
}

/**
 * 生成缩略图
 */
export async function generateThumbnails(
  buffer: Buffer
): Promise<ThumbnailResult[]> {
  const results: ThumbnailResult[] = [];

  for (const thumb of THUMBNAILS) {
    try {
      const pipeline = sharp(buffer).resize(thumb.width, thumb.height, {
        fit: thumb.fit,
        withoutEnlargement: true,
      });

      if (thumb.format === "webp") {
        pipeline.webp({ quality: thumb.quality });
      }

      const outputBuffer = await pipeline.toBuffer();
      const metadata = await sharp(outputBuffer).metadata();

      results.push({
        name: thumb.name,
        buffer: outputBuffer,
        width: metadata.width || thumb.width,
        height: metadata.height || thumb.height,
        format: thumb.format,
        size: outputBuffer.length,
      });
    } catch (err) {
      console.error(`生成缩略图 ${thumb.name} 失败:`, err);
    }
  }

  return results;
}

/**
 * 一次性生成所有变体和缩略图
 */
export async function generateAllVariants(
  buffer: Buffer,
  width: number,
  height: number
): Promise<{
  variants: VariantResult[];
  thumbnails: ThumbnailResult[];
}> {
  const [variants, thumbnails] = await Promise.all([
    generateVariants(buffer, width, height),
    generateThumbnails(buffer),
  ]);

  return { variants, thumbnails };
}

// ===== 存储函数 =====

/**
 * 上传变体到 MinIO
 * key 格式: variants/{imageId}/{variantName}.webp
 */
export async function uploadVariant(
  imageId: number,
  variant: VariantResult
): Promise<string> {
  const ext = variant.format === "original" ? "orig" : variant.format;
  const storageKey = `variants/${imageId}/${variant.name}.${ext}`;
  const mimeType = variant.format === "webp" ? "image/webp" : "image/jpeg";

  await putBuffer(variant.buffer, storageKey, mimeType);

  return getPublicUrl(storageKey);
}

/**
 * 上传缩略图到 MinIO
 * key 格式: thumbnails/{imageId}/{thumbName}.webp
 */
export async function uploadThumbnail(
  imageId: number,
  thumbnail: ThumbnailResult
): Promise<string> {
  const storageKey = `thumbnails/${imageId}/${thumbnail.name}.${thumbnail.format}`;
  const mimeType = thumbnail.format === "webp" ? "image/webp" : "image/jpeg";

  await putBuffer(thumbnail.buffer, storageKey, mimeType);

  return getPublicUrl(storageKey);
}

/**
 * 生成变体并上传到 MinIO，返回变体信息（用于写入数据库）
 */
export async function generateAndUploadVariants(
  imageId: number,
  buffer: Buffer,
  width: number,
  height: number
): Promise<{
  variants: Record<string, VariantInfo>;
  thumbnails: Record<string, ThumbnailInfo>;
}> {
  const { variants: variantResults, thumbnails: thumbnailResults } =
    await generateAllVariants(buffer, width, height);

  // 并行上传所有变体
  const variantEntries = await Promise.all(
    variantResults.map(async (v) => {
      const url = await uploadVariant(imageId, v);
      return [
        v.name,
        {
          url,
          width: v.width,
          height: v.height,
          size: v.size,
        } as VariantInfo,
      ] as [string, VariantInfo];
    })
  );

  // 并行上传所有缩略图
  const thumbnailEntries = await Promise.all(
    thumbnailResults.map(async (t) => {
      const url = await uploadThumbnail(imageId, t);
      return [
        t.name,
        {
          url,
          width: t.width,
          height: t.height,
          size: t.size,
        } as ThumbnailInfo,
      ] as [string, ThumbnailInfo];
    })
  );

  return {
    variants: Object.fromEntries(variantEntries),
    thumbnails: Object.fromEntries(thumbnailEntries),
  };
}

/**
 * 根据分辨率查找最匹配的变体名称
 * 用于下载 API 匹配预生成变体
 */
export function findBestVariantForResolution(
  width: number,
  height: number,
  variantsInfo: Record<string, VariantInfo> | null
): VariantInfo | null {
  if (!variantsInfo) return null;

  // 精确匹配：查找变体宽高与请求一致的
  for (const variant of VARIANTS) {
    if (variant.name === "original") continue;
    const info = variantsInfo[variant.name];
    if (info && info.width === width && info.height === height) {
      return info;
    }
  }

  // 宽容匹配：查找变体 maxWidth/maxHeight 能覆盖请求尺寸的
  for (const variant of VARIANTS) {
    if (variant.name === "original") continue;
    if (variant.maxWidth === null || variant.maxHeight === null) continue;
    const info = variantsInfo[variant.name];
    if (info && variant.maxWidth >= width && variant.maxHeight >= height) {
      return info;
    }
  }

  return null;
}