import sharp from "sharp";
import { query } from "@/lib/db";

// ========== 默认水印配置 ==========
const DEFAULT_CONFIG = {
  text: "BlankWallpaperSociety",
  opacity: 0.15,
  position: "bottom-right" as WatermarkPosition,
  fontSize: 0, // 0 表示自动根据图片尺寸计算
  color: "white",
  tiled: true, // 是否添加平铺防盗水印
};

type WatermarkPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";

interface WatermarkConfig {
  text: string;
  opacity: number;
  position: WatermarkPosition;
  fontSize: number;
  color: string;
  tiled: boolean;
}

/**
 * 从系统设置读取水印配置
 */
export async function getWatermarkConfig(): Promise<WatermarkConfig> {
  try {
    const rows = (await query(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('watermark_enabled', 'watermark_text', 'watermark_opacity', 'watermark_position', 'watermark_color', 'watermark_tiled')`
    )) as any[];

    const settingsMap = new Map(rows.map((r: any) => [r.setting_key, r.setting_value]));

    return {
      text: settingsMap.get("watermark_text") || DEFAULT_CONFIG.text,
      opacity: parseFloat(settingsMap.get("watermark_opacity") || String(DEFAULT_CONFIG.opacity)),
      position: (settingsMap.get("watermark_position") as WatermarkPosition) || DEFAULT_CONFIG.position,
      fontSize: parseInt(settingsMap.get("watermark_font_size") || "0"),
      color: settingsMap.get("watermark_color") || DEFAULT_CONFIG.color,
      tiled: settingsMap.get("watermark_tiled") === "false" ? false : DEFAULT_CONFIG.tiled,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * 检查水印是否启用（从系统设置读取）
 */
export async function isWatermarkEnabled(): Promise<boolean> {
  try {
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
 * 计算水印文字在SVG中的坐标
 */
function calcTextPosition(
  width: number,
  height: number,
  fontSize: number,
  text: string,
  position: WatermarkPosition,
  padding: number
): { x: number; y: number } {
  const textWidth = text.length * fontSize * 0.55;
  switch (position) {
    case "bottom-right":
      return { x: width - padding - textWidth, y: height - padding };
    case "bottom-left":
      return { x: padding, y: height - padding };
    case "top-right":
      return { x: width - padding - textWidth, y: padding + fontSize };
    case "top-left":
      return { x: padding, y: padding + fontSize };
    case "center":
      return { x: Math.floor((width - textWidth) / 2), y: Math.floor(height / 2) };
    default:
      return { x: width - padding - textWidth, y: height - padding };
  }
}

/**
 * 在图片上叠加文字水印
 * @param imageBuffer 原始图片 Buffer
 * @param config 水印配置（可选，默认从系统设置读取）
 * @returns 添加水印后的图片 Buffer
 */
export async function addWatermark(
  imageBuffer: Buffer,
  config?: Partial<WatermarkConfig>
): Promise<Buffer> {
  try {
    // 合并配置
    const finalConfig = config ? { ...DEFAULT_CONFIG, ...config } : await getWatermarkConfig();

    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // 根据图片尺寸调整水印大小
    const fontSize = finalConfig.fontSize > 0 ? finalConfig.fontSize : Math.max(16, Math.min(Math.floor(width / 30), 80));
    const padding = Math.floor(fontSize * 1.5);
    const { x, y } = calcTextPosition(width, height, fontSize, finalConfig.text, finalConfig.position, padding);

    // 构建 SVG 水印元素
    const svgElements: string[] = [];

    // 主水印
    svgElements.push(
      `<text x="${x}" y="${y}" class="watermark">${finalConfig.text}</text>`
    );

    // 平铺半透明水印（防盗用）
    if (finalConfig.tiled) {
      const centerX = Math.floor(width * 0.3);
      const centerY = Math.floor(height * 0.5);
      svgElements.push(
        `<text x="${centerX}" y="${centerY}" class="watermark" transform="rotate(-30, ${centerX}, ${centerY})">${finalConfig.text}</text>`
      );
      // 添加更多平铺水印覆盖更大区域
      svgElements.push(
        `<text x="${Math.floor(width * 0.7)}" y="${Math.floor(height * 0.3)}" class="watermark" transform="rotate(-30, ${Math.floor(width * 0.7)}, ${Math.floor(height * 0.3)})">${finalConfig.text}</text>`
      );
    }

    // 创建 SVG 水印
    const svgWatermark = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .watermark {
              fill: ${finalConfig.color};
              font-family: Arial, Helvetica, sans-serif;
              font-size: ${fontSize}px;
              font-weight: bold;
              opacity: ${finalConfig.opacity};
            }
          </style>
        </defs>
        ${svgElements.join("\n")}
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
 * 获取水印文字设置（兼容旧接口）
 */
export async function getWatermarkText(): Promise<string> {
  try {
    const config = await getWatermarkConfig();
    return config.text;
  } catch {
    return DEFAULT_CONFIG.text;
  }
}