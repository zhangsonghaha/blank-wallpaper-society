import { query } from "@/lib/db";
import { uploadFile } from "@/lib/minio";

// === AI 配置（数据库优先回退） ===

interface AiConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export async function getAiConfig(): Promise<AiConfig> {
  // 默认值：环境变量
  let provider = process.env.AI_PROVIDER || "openai";
  let apiKey = process.env.OPENAI_API_KEY || process.env.STABILITY_API_KEY || "";
  let baseUrl = process.env.AI_API_BASE_URL || "https://api.openai.com/v1";
  let model = process.env.AI_MODEL || "dall-e-3";
  let enabled = !!apiKey;

  try {
    // 优先从 ai_models + ai_model_providers 表获取默认图片生成模型
    const imageModelRows = (await query(
      `SELECT m.model_id, m.is_default, p.type AS provider_type, p.api_key, p.base_url, p.enabled AS provider_enabled
       FROM ai_models m
       LEFT JOIN ai_model_providers p ON m.provider_id = p.id
       WHERE m.model_type = 'image' AND m.enabled = 1 AND p.enabled = 1
       ORDER BY m.is_default DESC, m.id ASC
       LIMIT 1`
    )) as any[];

    if (imageModelRows.length > 0 && imageModelRows[0].api_key) {
      const row = imageModelRows[0];
      provider = row.provider_type || "openai";
      apiKey = row.api_key;
      baseUrl = row.base_url;
      model = row.model_id;
      enabled = true;
      return { provider, apiKey, baseUrl, model, enabled };
    }

    // 回退到 system_settings 表
    const settings = (await query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?, ?, ?)",
      ["ai_provider", "ai_api_key", "ai_api_base_url", "ai_model", "ai_enabled"]
    )) as any[];

    const settingMap = new Map<string, string>();
    settings.forEach((s: any) => settingMap.set(s.setting_key, s.setting_value || ""));

    // 数据库值作为回退（环境变量优先）
    if (!provider || provider === "openai") {
      if (settingMap.get("ai_provider")) provider = settingMap.get("ai_provider")!;
    }
    if (!apiKey && settingMap.get("ai_api_key")) {
      apiKey = settingMap.get("ai_api_key")!;
    }
    if (settingMap.get("ai_api_base_url")) {
      baseUrl = settingMap.get("ai_api_base_url")!;
    }
    if (settingMap.get("ai_model")) {
      model = settingMap.get("ai_model")!;
    }
    if (settingMap.get("ai_enabled") !== undefined) {
      enabled = settingMap.get("ai_enabled") === "true" && !!apiKey;
    }
  } catch {
    // 数据库不可用时回退到环境变量
  }

  return { provider, apiKey, baseUrl, model, enabled };
}

// === AI 生成风格配置 ===
export const AI_STYLES = {
  realistic: { name: "写实", prompt: "photorealistic, high resolution, detailed" },
  anime: { name: "动漫", prompt: "anime style, vibrant colors, detailed illustration" },
  abstract: { name: "抽象", prompt: "abstract art, modern, creative composition" },
  oil_painting: { name: "油画", prompt: "oil painting, classical art style, rich textures" },
  watercolor: { name: "水彩", prompt: "watercolor painting, soft colors, artistic" },
  cyberpunk: { name: "赛博朋克", prompt: "cyberpunk, neon lights, futuristic city" },
  nature: { name: "自然风光", prompt: "landscape photography, nature, scenic" },
  minimalist: { name: "极简", prompt: "minimalist design, clean, simple, elegant" },
} as const;

export type AiStyle = keyof typeof AI_STYLES;

// === DALL-E / 兼容 API 调用 ===
async function generateWithDallE(
  prompt: string,
  width: number,
  height: number,
  config: AiConfig
): Promise<{ imageUrl: string; tokensUsed: number }> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("未配置 AI API 密钥，请在后台系统设置中配置");
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const model = config.model || "dall-e-3";

  // API 支持的尺寸列表（sensenova-u1-fast / SiliconFlow 等）
  // 11 种宽高比对应的 2K 分辨率
  const ALLOWED_SIZES: { size: string; ratio: number }[] = [
    { size: "1664x2496", ratio: 2 / 3 },   // 竖屏 2:3
    { size: "2496x1664", ratio: 3 / 2 },   // 横屏 3:2
    { size: "1760x2368", ratio: 3 / 4 },   // 竖屏 3:4
    { size: "2368x1760", ratio: 4 / 3 },   // 横屏 4:3
    { size: "1824x2272", ratio: 4 / 5 },   // 竖屏 4:5
    { size: "2272x1824", ratio: 5 / 4 },   // 横屏 5:4
    { size: "2048x2048", ratio: 1 / 1 },   // 方形 1:1
    { size: "2752x1536", ratio: 16 / 9 },  // 横屏 16:9
    { size: "1536x2752", ratio: 9 / 16 },  // 竖屏 9:16
    { size: "3072x1376", ratio: 21 / 9 },  // 超宽 21:9
    { size: "1344x3136", ratio: 9 / 21 },  // 超高 9:21
  ];

  // 根据请求的宽高比，选择最接近的允许尺寸
  const targetRatio = width / height;
  let size = "2752x1536"; // 默认 16:9 横屏壁纸
  let bestDiff = Infinity;

  for (const s of ALLOWED_SIZES) {
    const diff = Math.abs(targetRatio - s.ratio);
    if (diff < bestDiff) {
      bestDiff = diff;
      size = s.size;
    }
  }

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`AI API错误: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    imageUrl: data.data[0]?.url,
    tokensUsed: 1, // DALL-E按次计费
  };
}

// === Stability AI API 调用 ===
async function generateWithStability(
  prompt: string,
  width: number,
  height: number,
  style: AiStyle,
  config: AiConfig
): Promise<{ imageBuffer: Buffer; tokensUsed: number }> {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error("未配置 AI API 密钥，请在后台系统设置中配置");
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const stylePrompt = AI_STYLES[style]?.prompt || "";

  const response = await fetch(
    `${baseUrl}/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        text_prompts: [
          { text: `${prompt}, ${stylePrompt}`, weight: 1 },
          { text: "blurry, low quality, watermark, text", weight: -1 },
        ],
        cfg_scale: 7,
        height: Math.min(height, 1024),
        width: Math.min(width, 1024),
        steps: 30,
        samples: 1,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Stability API错误: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  const base64 = data.artifacts[0]?.base64;
  if (!base64) throw new Error("Stability API未返回图片数据");

  return {
    imageBuffer: Buffer.from(base64, "base64"),
    tokensUsed: 1,
  };
}

// === 主生成函数 ===
export async function generateWallpaper(params: {
  userId: number;
  prompt: string;
  style: AiStyle;
  width: number;
  height: number;
  model?: string;
}): Promise<{
  generationId: number;
  imageUrl: string;
  imageId?: number;
}> {
  const { userId, prompt, style, width, height, model = "dall-e" } = params;

  // 获取AI配置
  const config = await getAiConfig();
  if (!config.enabled) {
    throw new Error("AI生成功能未启用，请在后台系统设置中配置");
  }

  // 创建生成记录
  const result = await query(
    `INSERT INTO ai_generations (user_id, prompt, style, width, height, status, model)
     VALUES (?, ?, ?, ?, ?, 'processing', ?)`,
    [userId, prompt, style, width, height, config.provider === "stability" ? "stability" : model]
  );
  const generationId = (result as any).insertId;

  try {
    let imageUrl: string;

    if (config.provider === "stability") {
      // Stability AI: 返回base64，需要上传到MinIO
      const { imageBuffer } = await generateWithStability(prompt, width, height, style, config);
      const timestamp = Date.now();
      const uploadResult = await uploadFile(
        imageBuffer,
        `ai_gen_${timestamp}.png`,
        "image/png"
      );
      imageUrl = uploadResult.url;

      await query(
        "UPDATE ai_generations SET tokens_used = 1 WHERE id = ?",
        [generationId]
      );
    } else {
      // OpenAI / 兼容 API: 返回URL
      const genResult = await generateWithDallE(prompt, width, height, config);
      imageUrl = genResult.imageUrl;

      // URL临时有效，下载并上传到MinIO
      const imageRes = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
      const timestamp = Date.now();
      const uploadResult = await uploadFile(
        imageBuffer,
        `ai_gen_${timestamp}.png`,
        "image/png"
      );
      imageUrl = uploadResult.url;

      await query(
        "UPDATE ai_generations SET tokens_used = ? WHERE id = ?",
        [genResult.tokensUsed, generationId]
      );
    }

    // 更新生成记录为完成
    await query(
      "UPDATE ai_generations SET status = 'completed', result_url = ?, completed_at = NOW() WHERE id = ?",
      [imageUrl, generationId]
    );

    return { generationId, imageUrl };
  } catch (error: any) {
    // 更新生成记录为失败
    await query(
      "UPDATE ai_generations SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?",
      [error.message, generationId]
    );
    throw error;
  }
}

// === 超分辨率增强（placeholder，需要 real-esrgan-node） ===
export async function upscaleImage(
  imageBuffer: Buffer,
  scale: number = 2
): Promise<Buffer> {
  // TODO: 集成 real-esrgan-node 进行超分辨率
  // const { upscale } = require('real-esrgan-node');
  // return await upscale(imageBuffer, { scale });
  throw new Error("超分辨率功能暂未实现，需要部署 Real-ESRGAN 模型");
}

// === 风格迁移（placeholder） ===
export async function styleTransfer(
  imageBuffer: Buffer,
  style: string
): Promise<Buffer> {
  // TODO: 集成风格迁移模型
  throw new Error("风格迁移功能暂未实现，需要部署风格迁移模型");
}

// === 获取用户AI生成历史 ===
export async function getUserGenerations(
  userId: number,
  limit: number = 20,
  offset: number = 0
) {
  const rows = await query(
    `SELECT * FROM ai_generations WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const countResult = await query(
    "SELECT COUNT(*) as total FROM ai_generations WHERE user_id = ?",
    [userId]
  ) as any[];

  return {
    data: rows,
    total: countResult[0]?.total || 0,
  };
}