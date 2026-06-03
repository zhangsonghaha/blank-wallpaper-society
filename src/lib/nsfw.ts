/**
 * NSFW 自动检测服务
 * 使用 nsfwjs + @tensorflow/tfjs（纯JS版，无需C++原生编译）进行服务端图片内容安全检测
 *
 * 分类：Drawing, Hentai, Neutral, Porn, Sexy
 * 默认阈值：Porn > 0.7 或 Hentai > 0.7 标记为可疑
 * 默认行为：pending（标记+设为待审核状态，需管理员确认）
 */

import { db } from "@/lib/db";
import { sql } from "kysely";

// NSFW 分类类型
export interface NSFWClassification {
  Drawing: number;
  Hentai: number;
  Neutral: number;
  Porn: number;
  Sexy: number;
}

export interface NSFWResult {
  classifications: NSFWClassification;
  flagged: boolean;
  maxCategory: string;
  maxScore: number;
}

// NSFW 检测行为
export type NSFWAction = "flag" | "pending" | "reject";

// 系统设置缓存
let cachedSettings: {
  enabled: boolean;
  threshold: number;
  action: NSFWAction;
} | null = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 60_000; // 1 分钟缓存

// 模型单例
let model: any = null;
let modelLoading = false;

/**
 * 获取 NSFW 检测设置
 */
export async function getNSFWSettings(): Promise<{
  enabled: boolean;
  threshold: number;
  action: NSFWAction;
}> {
  const now = Date.now();
  if (cachedSettings && now - settingsCacheTime < SETTINGS_CACHE_TTL) {
    return cachedSettings;
  }

  try {
    const rows = await db.selectFrom("system_settings")
      .select(["setting_key", "setting_value"])
      .where("setting_key", "in", ["nsfw_enabled", "nsfw_threshold", "nsfw_action"])
      .execute();

    const settingsMap: Record<string, string> = {};
    for (const row of rows) {
      settingsMap[row.setting_key] = row.setting_value || "";
    }

    cachedSettings = {
      enabled: settingsMap.nsfw_enabled === "true",
      threshold: parseFloat(settingsMap.nsfw_threshold) || 0.7,
      action: (["flag", "pending", "reject"].includes(settingsMap.nsfw_action)
        ? settingsMap.nsfw_action
        : "reject") as NSFWAction,
    };
    settingsCacheTime = now;
    return cachedSettings;
  } catch {
    return { enabled: false, threshold: 0.7, action: "reject" };
  }
}

/**
 * 清除设置缓存（设置更新时调用）
 */
export function clearNSFWSettingsCache() {
  cachedSettings = null;
  settingsCacheTime = 0;
}

/**
 * 加载 NSFW.js 模型（单例模式）
 * 使用纯JS版 @tensorflow/tfjs，无需C++原生编译
 */
async function loadModel(): Promise<any> {
  if (model) return model;
  if (modelLoading) {
    // 等待模型加载完成
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return loadModel();
  }

  modelLoading = true;
  try {
    await import("@tensorflow/tfjs");
    const nsfwjs = await import("nsfwjs");
    model = await nsfwjs.load("MobileNetV2");
    console.log("[NSFW] 模型加载完成（纯JS版 tfjs）");
    return model;
  } catch (error) {
    console.error("[NSFW] 模型加载失败:", error);
    model = null;
    throw error;
  } finally {
    modelLoading = false;
  }
}

/**
 * 对图片 Buffer 进行 NSFW 检测
 * 使用 sharp 解码图片为 RGB 像素数据，再转为 tfjs tensor
 * @param imageBuffer 图片的 Buffer 数据
 * @param threshold 可疑阈值（默认 0.7）
 * @returns NSFW 检测结果
 */
export async function detectNSFW(
  imageBuffer: Buffer,
  threshold: number = 0.7
): Promise<NSFWResult> {
  try {
    const loadedModel = await loadModel();

    // 使用 sharp 解码图片为原始 RGB 像素数据
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(imageBuffer)
      .resize(299, 299, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tf = await import("@tensorflow/tfjs");
    // 从 RGB 像素数据创建 tensor [height, width, 3] -> [1, height, width, 3]
    const imageTensor = tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, 3],
      "int32"
    );

    try {
      // 执行分类
      const predictions = await loadedModel.classify(imageTensor);

    // 转换为分类对象
    const classifications: NSFWClassification = {
      Drawing: 0,
      Hentai: 0,
      Neutral: 0,
      Porn: 0,
      Sexy: 0,
    };

    for (const pred of predictions) {
      const className = pred.className as keyof NSFWClassification;
      if (className in classifications) {
        classifications[className] = pred.probability;
      }
    }

    // 判断是否标记为可疑
    const flagged =
      classifications.Porn > threshold || classifications.Hentai > threshold;

    // 找出最高分类
    let maxCategory = "Neutral";
    let maxScore = 0;
    for (const [cat, score] of Object.entries(classifications)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = cat;
      }
    }

    return { classifications, flagged, maxCategory, maxScore };
    } finally {
      imageTensor.dispose();
    }
  } catch (error) {
    console.error("[NSFW] 检测失败:", error);
    // 检测失败时返回默认结果（不标记）
    return {
      classifications: { Drawing: 0, Hentai: 0, Neutral: 1, Porn: 0, Sexy: 0 },
      flagged: false,
      maxCategory: "Neutral",
      maxScore: 1,
    };
  }
}

export interface NSFWAutoReviewResult {
  flagged: boolean;
  autoApproved: boolean;
  autoRejected: boolean;
  maxCategory: string;
  maxScore: number;
}

/**
 * 处理上传图片的 NSFW 自动审核（同步，在上传响应返回前完成）
 * 
 * 自动审核逻辑：
 * - flagged=true + action=reject → 自动拒绝
 * - flagged=true + action=pending → 保持待审核，需人工确认
 * - flagged=true + action=flag → 仅标记，不改变状态
 * - flagged=false → 自动通过（无论什么action）
 * 
 * @param imageId 图片 ID
 * @param imageBuffer 图片 Buffer
 * @returns 自动审核结果
 */
export async function processNSFWDetection(
  imageId: number,
  imageBuffer: Buffer
): Promise<NSFWAutoReviewResult> {
  const defaultResult: NSFWAutoReviewResult = {
    flagged: false,
    autoApproved: false,
    autoRejected: false,
    maxCategory: "Neutral",
    maxScore: 1,
  };

  try {
    const settings = await getNSFWSettings();
    if (!settings.enabled) return defaultResult;

    const result = await detectNSFW(imageBuffer, settings.threshold);

    // 存储检测结果
    await db.updateTable("images")
      .set({
        nsfw_score: JSON.stringify(result.classifications),
        nsfw_flagged: result.flagged ? 1 : 0,
      })
      .where("id", "=", imageId)
      .execute();

    if (result.flagged) {
      console.log(
        `[NSFW] 图片 #${imageId} 被标记为可疑 (${result.maxCategory}: ${(result.maxScore * 100).toFixed(1)}%)`
      );

      if (settings.action === "reject") {
        // 自动拒绝违规内容
        await db.updateTable("images")
          .set({ status: "rejected", reject_reason: "NSFW自动审核：内容可能违规" })
          .where("id", "=", imageId)
          .execute();
        // 从搜索索引中删除
        try {
          const { deleteImage } = await import("@/lib/meilisearch");
          deleteImage(imageId).catch(() => {});
        } catch {}
        return {
          flagged: true,
          autoApproved: false,
          autoRejected: true,
          maxCategory: result.maxCategory,
          maxScore: result.maxScore,
        };
      } else if (settings.action === "pending") {
        // 标记 + 设为待审核状态，需人工确认
        await db.updateTable("images")
          .set({
            status: "pending",
            reviewed_by: null,
            reviewed_at: null,
            reject_reason: null,
          } as any)
          .where("id", "=", imageId)
          .where("status", "!=", "pending")
          .execute();
        return {
          flagged: true,
          autoApproved: false,
          autoRejected: false,
          maxCategory: result.maxCategory,
          maxScore: result.maxScore,
        };
      }
      // flag 模式仅标记，不改变状态
      return {
        flagged: true,
        autoApproved: false,
        autoRejected: false,
        maxCategory: result.maxCategory,
        maxScore: result.maxScore,
      };
    }

    // 内容安全 → 自动通过审核
    console.log(`[NSFW] 图片 #${imageId} 内容安全，自动通过审核`);
    await db.updateTable("images")
      .set({
        status: "approved",
        reviewed_by: null,
        reviewed_at: sql`NOW()`,
      } as any)
      .where("id", "=", imageId)
      .where("status", "=", "pending")
      .execute();

    // 自动通过 → 索引到搜索
    try {
      const newImage = await db.selectFrom("images")
        .where("id", "=", imageId)
        .selectAll()
        .execute();
      const { indexImage, dbRowToSearchData } = await import("@/lib/meilisearch");
      if (newImage.length > 0) {
        indexImage(dbRowToSearchData(newImage[0] as any)).catch(() => {});
      }
    } catch {}

    return {
      flagged: false,
      autoApproved: true,
      autoRejected: false,
      maxCategory: result.maxCategory,
      maxScore: result.maxScore,
    };
  } catch (error) {
    console.error(`[NSFW] 处理图片 #${imageId} 失败:`, error);
    return defaultResult;
  }
}