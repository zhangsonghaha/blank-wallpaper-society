/**
 * API Schema 验证库
 * 使用 Zod 定义所有 API 请求/响应的 Schema
 * 提供统一的验证工具函数
 */

import { z } from "zod";

// === 通用 Schema ===

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// === 用户相关 Schema ===

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "用户名至少2个字符")
    .max(30, "用户名最多30个字符")
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, "用户名只能包含字母、数字、下划线和中文"),
  email: z.string().email("邮箱格式不正确"),
  password: z
    .string()
    .min(8, "密码至少8个字符")
    .max(128, "密码最多128个字符"),
  nickname: z.string().max(50).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export const updateProfileSchema = z.object({
  nickname: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
});

// === 图片相关 Schema ===

export const uploadSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateImageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

// === 评论相关 Schema ===

export const createCommentSchema = z.object({
  image_id: z.coerce.number().int().positive(),
  content: z
    .string()
    .min(1, "评论内容不能为空")
    .max(1000, "评论最多1000个字符"),
  parent_id: z.coerce.number().int().positive().optional(),
});

// === 合集相关 Schema ===

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  is_public: z.boolean().default(true),
});

// === 通知相关 Schema ===

export const updateNotificationSettingsSchema = z.object({
  notify_system: z.coerce.number().int().min(0).max(1).optional(),
  notify_like: z.coerce.number().int().min(0).max(1).optional(),
  notify_comment: z.coerce.number().int().min(0).max(1).optional(),
  notify_review: z.coerce.number().int().min(0).max(1).optional(),
  notify_follow: z.coerce.number().int().min(0).max(1).optional(),
  notify_achievement: z.coerce.number().int().min(0).max(1).optional(),
  notify_favorite: z.coerce.number().int().min(0).max(1).optional(),
  email_system: z.coerce.number().int().min(0).max(1).optional(),
  email_review: z.coerce.number().int().min(0).max(1).optional(),
  email_achievement: z.coerce.number().int().min(0).max(1).optional(),
});

// === 管理员 Schema ===

export const adminUpdateUserSchema = z.object({
  role: z.enum(["user", "reviewer", "admin"]).optional(),
  status: z.enum(["active", "banned", "deleted"]).optional(),
  level: z.coerce.number().int().min(0).max(100).optional(),
});

export const adminReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
  ids: z.array(z.coerce.number().int().positive()).min(1),
});

// === 机器人配置 Schema ===

export const botConfigSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().min(1, "名称不能为空").max(100),
  type: z.enum(["feishu", "qq", "dingtalk", "wechat_work", "slack", "custom"]),
  auth_mode: z.enum(["webhook", "app"]).default("webhook"),
  app_id: z.string().max(200).nullable().optional(),
  app_secret: z.string().max(200).nullable().optional(),
  chat_id: z.string().max(200).nullable().optional(),
  webhook_url: z.string().max(500).optional(),
  secret: z.string().max(200).nullable().optional(),
  enabled: z.coerce.number().int().min(0).max(1).default(1),
  subscribe_events: z.array(z.string()).nullable().optional(),
  feishu_msg_type: z.enum(["interactive", "text", "post"]).default("interactive"),
  qq_group_id: z.string().max(50).nullable().optional(),
  custom_method: z.enum(["POST", "PUT", "PATCH"]).default("POST"),
  custom_headers: z.record(z.string(), z.string()).nullable().optional(),
  custom_body_template: z.string().nullable().optional(),
});

// === Webhook 订阅 Schema ===

export const webhookSubscriptionSchema = z.object({
  url: z.string().min(1, "URL 不能为空").max(500).url("URL 格式不正确"),
  events: z.array(
    z.enum([
      "image.uploaded",
      "image.approved",
      "image.rejected",
      "image.deleted",
      "comment.created",
      "comment.deleted",
      "user.registered",
      "user.followed",
      "user.levelup",
      "achievement.unlocked",
      "collection.created",
      "order.created",
      "order.completed",
    ])
  ).min(1, "至少选择一个事件"),
  secret: z.string().max(200).optional(),
  max_retries: z.coerce.number().int().min(0).max(10).default(3),
  retry_interval: z.coerce.number().int().min(10).max(3600).default(60),
  timeout_ms: z.coerce.number().int().min(1000).max(30000).default(5000),
});

// === 创作者认证 Schema ===

export const creatorApplicationSchema = z.object({
  real_name: z.string().min(1, "真实姓名不能为空").max(100),
  id_type: z.enum(["id_card", "passport", "driver_license", "other"], { required_error: "请选择身份证明类型" }),
  id_number: z.string().min(1, "身份证明编号不能为空").max(100),
  portfolio_url: z.string().max(500).optional().or(z.literal("")),
  brand_name: z.string().max(100).optional(),
  brand_description: z.string().max(1000).optional(),
});

export const brandProfileSchema = z.object({
  brand_name: z.string().min(1, "品牌名不能为空").max(100),
  brand_description: z.string().max(1000).optional(),
  brand_website: z.string().max(500).optional().or(z.literal("")),
  social_links: z.record(z.string(), z.string()).optional(),
});

export const adminVerifySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

// === API Key Schema ===

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(["free", "pro", "enterprise"]).default("free"),
});

// === 验证工具函数 ===

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * 验证数据是否符合 Schema
 */
export function validateData<T>(
  schema: z.ZodType<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return { success: false, errors };
}

/**
 * 验证 API 请求体，失败时返回 400 响应
 */
export function validateRequestBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { data: T } | { error: Record<string, string[]> } {
  const result = validateData(schema, body);
  if (result.success) {
    return { data: result.data! };
  }
  return { error: result.errors! };
}