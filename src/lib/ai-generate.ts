import { query } from "@/lib/db";
import { uploadFile } from "@/lib/minio";

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

// === DALL-E API 调用 ===
async function generateWithDallE(
  prompt: string,
  width: number,
  height: number
): Promise<{ imageUrl: string; tokensUsed: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 OPENAI_API_KEY");
  }

  // DALL-E 3 支持的尺寸: 1024x1024, 1024x1792, 1792x1024
  let size = "1024x1024";
  if (height > width) size = "1024x1792";
  if (width > height) size = "1792x1024";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "hd",
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`DALL-E API错误: ${error.error?.message || response.statusText}`);
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
  style: AiStyle
): Promise<{ imageBuffer: Buffer; tokensUsed: number }> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 STABILITY_API_KEY");
  }

  const stylePrompt = AI_STYLES[style]?.prompt || "";

  const response = await fetch(
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
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

  // 创建生成记录
  const result = await query(
    `INSERT INTO ai_generations (user_id, prompt, style, width, height, status, model)
     VALUES (?, ?, ?, ?, ?, 'processing', ?)`,
    [userId, prompt, style, width, height, model]
  );
  const generationId = (result as any).insertId;

  try {
    let imageUrl: string;

    if (model === "stability") {
      // Stability AI: 返回base64，需要上传到MinIO
      const { imageBuffer } = await generateWithStability(prompt, width, height, style);
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
      // DALL-E: 返回URL
      const genResult = await generateWithDallE(prompt, width, height);
      imageUrl = genResult.imageUrl;

      // DALL-E的URL临时有效，下载并上传到MinIO
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