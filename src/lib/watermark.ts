import sharp from "sharp";

const WATERMARK_TEXT = "ImageGallery";
const WATERMARK_OPACITY = 0.15;

/**
 * 在图片上叠加文字水印
 * @param imageBuffer 原始图片 Buffer
 * @param text 水印文字（默认 ImageGallery）
 * @returns 添加水印后的图片 Buffer
 */
export async function addWatermark(
  imageBuffer: Buffer,
  text: string = WATERMARK_TEXT
): Promise<Buffer> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // 根据图片尺寸调整水印大小
    const fontSize = Math.max(16, Math.min(Math.floor(width / 30), 80));
    const padding = Math.floor(fontSize * 1.5);

    // 创建 SVG 水印
    const svgWatermark = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .watermark {
              fill: white;
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${fontSize}px;
              font-weight: bold;
              opacity: ${WATERMARK_OPACITY};
            }
          </style>
        </defs>
        <!-- 右下角主水印 -->
        <text x="${width - padding - text.length * fontSize * 0.55}" y="${height - padding}" class="watermark">${text}</text>
        <!-- 平铺半透明水印（防盗用） -->
        <text x="${Math.floor(width * 0.3)}" y="${Math.floor(height * 0.5)}" class="watermark" transform="rotate(-30, ${Math.floor(width * 0.3)}, ${Math.floor(height * 0.5)})">${text}</text>
      </svg>
    `;

    const watermarkBuffer = Buffer.from(svgWatermark);

    // 使用 sharp 合成水印
    const result = await sharp(imageBuffer)
      .composite([
        {
          input: watermarkBuffer,
          blend: "over",
          top: 0,
          left: 0,
        },
      ])
      .toBuffer();

    return result;
  } catch (error) {
    console.error("水印叠加失败:", error);
    // 水印失败时返回原图
    return imageBuffer;
  }
}

/**
 * 检查水印是否启用（从系统设置读取）
 */
export async function isWatermarkEnabled(): Promise<boolean> {
  try {
    const { query } = await import("@/lib/db");
    const rows = (await query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'watermark_enabled'"
    )) as any[];

    if (rows.length > 0) {
      return rows[0].setting_value === "true" || rows[0].setting_value === "1";
    }
    // 默认不启用
    return false;
  } catch {
    return false;
  }
}

/**
 * 获取水印文字设置
 */
export async function getWatermarkText(): Promise<string> {
  try {
    const { query } = await import("@/lib/db");
    const rows = (await query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'watermark_text'"
    )) as any[];

    if (rows.length > 0 && rows[0].setting_value) {
      return rows[0].setting_value;
    }
    return WATERMARK_TEXT;
  } catch {
    return WATERMARK_TEXT;
  }
}