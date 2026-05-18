/**
 * AI 聊天服务
 * 支持从数据库读取模型配置，调用 OpenAI 兼容 API 进行对话
 * 用于机器人消息回复
 */

import { query } from "@/lib/db";

// === 类型定义 ===

interface ModelProvider {
  id: number;
  name: string;
  type: string;
  base_url: string;
  api_key: string;
  enabled: number;
}

interface AiModel {
  id: number;
  provider_id: number;
  model_id: string;
  display_name: string | null;
  model_type: string;
  enabled: number;
  is_default: number;
  max_tokens: number;
  extra_config: Record<string, any> | null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// === 配置缓存 ===

let modelConfigCache: { data: { providers: ModelProvider[]; models: AiModel[] }; expiresAt: number } | null = null;
const MODEL_CONFIG_TTL = 5 * 60 * 1000; // 5分钟

export function clearModelConfigCache(): void {
  modelConfigCache = null;
}

async function getModelConfigs(): Promise<{ providers: ModelProvider[]; models: AiModel[] }> {
  if (modelConfigCache && Date.now() < modelConfigCache.expiresAt) {
    return modelConfigCache.data;
  }

  const providers = (await query(
    "SELECT * FROM ai_model_providers WHERE enabled = 1"
  )) as ModelProvider[];

  const models = (await query(
    "SELECT * FROM ai_models WHERE enabled = 1"
  )) as (AiModel & { extra_config: string | null })[];

  const parsedModels = models.map((m) => ({
    ...m,
    extra_config: m.extra_config
      ? typeof m.extra_config === "string"
        ? JSON.parse(m.extra_config)
        : m.extra_config
      : null,
  }));

  modelConfigCache = {
    data: { providers, models: parsedModels },
    expiresAt: Date.now() + MODEL_CONFIG_TTL,
  };

  return modelConfigCache.data;
}

// === 获取默认聊天模型 ===

export async function getDefaultChatModel(): Promise<{ provider: ModelProvider; model: AiModel } | null> {
  const { providers, models } = await getModelConfigs();

  // 优先找 is_default = 1 的聊天模型
  let chatModel = models.find((m) => m.model_type === "chat" && m.is_default === 1);

  // 没有默认的，取第一个可用的聊天模型
  if (!chatModel) {
    chatModel = models.find((m) => m.model_type === "chat");
  }

  if (!chatModel) return null;

  const provider = providers.find((p) => p.id === chatModel!.provider_id);
  if (!provider) return null;

  return { provider, model: chatModel };
}

// === 获取指定模型 ===

export async function getModelById(modelId: number): Promise<{ provider: ModelProvider; model: AiModel } | null> {
  const { providers, models } = await getModelConfigs();
  const model = models.find((m) => m.id === modelId);
  if (!model) return null;
  const provider = providers.find((p) => p.id === model.provider_id);
  if (!provider) return null;
  return { provider, model };
}

// === 获取默认图片生成模型 ===

export async function getDefaultImageModel(): Promise<{ provider: ModelProvider; model: AiModel } | null> {
  const { providers, models } = await getModelConfigs();
  let imageModel = models.find((m) => m.model_type === "image" && m.is_default === 1);
  if (!imageModel) {
    imageModel = models.find((m) => m.model_type === "image");
  }
  if (!imageModel) return null;
  const provider = providers.find((p) => p.id === imageModel!.provider_id);
  if (!provider) return null;
  return { provider, model: imageModel };
}

// === OpenAI 兼容 API 聊天 ===

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    modelId?: number;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }
): Promise<ChatResponse> {
  let provider: ModelProvider;
  let model: AiModel;

  if (options?.modelId) {
    const result = await getModelById(options.modelId);
    if (!result) throw new Error("指定的模型不存在或未启用");
    provider = result.provider;
    model = result.model;
  } else {
    const result = await getDefaultChatModel();
    if (!result) throw new Error("未配置可用的聊天模型，请在后台模型管理中配置");
    provider = result.provider;
    model = result.model;
  }

  const baseUrl = provider.base_url.replace(/\/+$/, "");
  const maxTokens = options?.maxTokens || model.max_tokens || 4096;
  const temperature = options?.temperature ?? (model.extra_config as any)?.temperature ?? 0.7;

  const requestBody: Record<string, any> = {
    model: model.model_id,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  // Anthropic API 格式适配
  if (provider.type === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");

    requestBody.model = model.model_id;
    requestBody.messages = nonSystemMsgs.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
    if (systemMsg) {
      requestBody.system = systemMsg.content;
    }
    requestBody.max_tokens = maxTokens;

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API 错误 (${res.status}): ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return {
      content: data.content?.[0]?.text || "",
      model: model.model_id,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.input_tokens || 0,
            completion_tokens: data.usage.output_tokens || 0,
            total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : undefined,
    };
  }

  // OpenAI 兼容 API（默认）
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`API 错误 (${res.status}): ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || model.model_id,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens || 0,
          completion_tokens: data.usage.completion_tokens || 0,
          total_tokens: data.usage.total_tokens || 0,
        }
      : undefined,
  };
}

// === 系统问答知识库 ===

const SYSTEM_PROMPT = `你是"空白壁纸社"网站的AI助手，通过飞书机器人与用户对话。你需要友好、专业地回答用户的问题。

关于"空白壁纸社"你可以回答以下类型的问题：
1. 网站功能介绍：这是一个壁纸分享和下载平台，用户可以上传、浏览、下载高清壁纸
2. 如何使用网站：注册账号、浏览壁纸、收藏、下载、上传壁纸等
3. 会员体系：免费用户和付费会员的区别
4. 壁纸分类：风景、动漫、抽象、自然、城市等分类
5. AI生成壁纸：网站支持AI生成壁纸功能
6. 挑战赛：定期举办壁纸创作挑战赛
7. 社区功能：评论、点赞、关注、收藏等社交功能

如果用户问到你不了解的问题，请诚实告知，并建议用户访问网站或联系管理员。
回答请简洁明了，适合在聊天窗口中阅读。`;

export async function chatWithBot(
  userMessage: string,
  context?: {
    botName?: string;
    chatHistory?: ChatMessage[];
  }
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // 添加历史消息（最近10轮）
  if (context?.chatHistory) {
    const recentHistory = context.chatHistory.slice(-20); // 最近20条消息
    messages.push(...recentHistory);
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 2048,
    });

    return response.content || "抱歉，我暂时无法回答这个问题，请稍后再试。";
  } catch (error: any) {
    console.error("[AiChat] chatWithBot error:", error);
    return `抱歉，AI服务暂时不可用：${error.message || "未知错误"}`;
  }
}

// === 图片生成（通过聊天模型） ===

export async function generateImagePrompt(
  userDescription: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是一个壁纸描述生成助手。根据用户的简短描述，生成一个详细的英文图片生成prompt，适合用于DALL-E或Stable Diffusion。只输出prompt，不要其他内容。",
    },
    { role: "user", content: userDescription },
  ];

  try {
    const response = await chatCompletion(messages, {
      temperature: 0.8,
      maxTokens: 500,
    });
    return response.content || userDescription;
  } catch (error: any) {
    console.error("[AiChat] generateImagePrompt error:", error);
    return userDescription;
  }
}