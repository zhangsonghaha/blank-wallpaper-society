/**
 * 邮件模板引擎
 * 支持从数据库加载模板，渲染动态变量 {{variable}}
 * 提供模板 CRUD 和变量快捷插入功能
 */

import { query } from "@/lib/db";

// === 模板变量定义 ===
export interface TemplateVariable {
  key: string;       // 变量标识，如 user_name
  label: string;     // 显示名称，如 用户名
  example: string;   // 示例值，如 小明
}

// === 模板分类 ===
export type TemplateCategory = "auth" | "review" | "notification" | "system" | "social";

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  auth: "认证相关",
  review: "审核相关",
  notification: "通知相关",
  system: "系统相关",
  social: "社交相关",
};

// === 数据库模板行 ===
export interface EmailTemplateRow {
  id: number;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string | TemplateVariable[]; // MySQL 驱动可能返回字符串或已解析对象
  category: TemplateCategory;
  is_builtin: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// === 解析后的模板 ===
export interface EmailTemplate extends Omit<EmailTemplateRow, "variables"> {
  variables: TemplateVariable[];
}

// === 模板渲染结果 ===
export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

// === 全局通用变量（所有模板都可使用） ===
export const GLOBAL_VARIABLES: TemplateVariable[] = [
  { key: "site_url", label: "网站地址", example: "https://example.com" },
  { key: "site_name", label: "网站名称", example: "壁纸社区" },
  { key: "current_year", label: "当前年份", example: new Date().getFullYear().toString() },
  { key: "current_date", label: "当前日期", example: new Date().toLocaleDateString("zh-CN") },
];

// === 变量分类分组（用于快捷插入面板） ===
export const VARIABLE_GROUPS: Record<string, TemplateVariable[]> = {
  "通用变量": GLOBAL_VARIABLES,
  "用户信息": [
    { key: "user_name", label: "用户名", example: "小明" },
    { key: "user_email", label: "用户邮箱", example: "user@example.com" },
    { key: "user_id", label: "用户ID", example: "123" },
    { key: "user_role", label: "用户角色", example: "creator" },
    { key: "user_level", label: "用户等级", example: "5" },
  ],
  "壁纸信息": [
    { key: "image_title", label: "壁纸标题", example: "美丽风景" },
    { key: "image_id", label: "壁纸ID", example: "123" },
    { key: "image_url", label: "壁纸链接", example: "https://example.com/image/123" },
    { key: "image_category", label: "壁纸分类", example: "自然" },
    { key: "image_width", label: "壁纸宽度", example: "1920" },
    { key: "image_height", label: "壁纸高度", example: "1080" },
  ],
  "审核信息": [
    { key: "review_status", label: "审核状态", example: "approved/rejected" },
    { key: "review_reason", label: "拒绝原因", example: "图片模糊" },
    { key: "review_comment", label: "审核备注", example: "请提高图片质量" },
    { key: "reviewer_name", label: "审核员", example: "管理员" },
  ],
  "认证信息": [
    { key: "reset_url", label: "重置链接", example: "https://example.com/reset-password?token=xxx" },
    { key: "token_expiry", label: "链接有效期", example: "1小时" },
  ],
  "通知信息": [
    { key: "notification_title", label: "通知标题", example: "有人收藏了你的壁纸" },
    { key: "notification_content", label: "通知内容", example: "小红收藏了你的壁纸" },
    { key: "notification_type", label: "通知类型", example: "favorite" },
  ],
};

/**
 * 解析模板行，将 JSON 字符串的 variables 转为数组
 * 注意：MySQL mysql2 驱动对 JSON 列会自动解析为对象，也可能是字符串
 */
function parseTemplateRow(row: EmailTemplateRow): EmailTemplate {
  let variables: TemplateVariable[] = [];
  try {
    if (row.variables) {
      if (typeof row.variables === "string") {
        variables = JSON.parse(row.variables);
      } else if (Array.isArray(row.variables)) {
        variables = row.variables as unknown as TemplateVariable[];
      } else if (typeof row.variables === "object") {
        // 兜底：已解析的对象直接使用
        variables = row.variables as unknown as TemplateVariable[];
      }
    }
  } catch {
    console.warn(`[EmailTemplate] 解析模板变量失败: ${row.template_key}`);
  }

  const { variables: _, ...rest } = row;
  return { ...rest, variables };
}

/**
 * 渲染模板：将 {{variable}} 替换为实际值
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * 获取全局变量默认值
 */
export function getGlobalVariableDefaults(): Record<string, string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return {
    site_url: baseUrl,
    site_name: "壁纸社区",
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString("zh-CN"),
  };
}

/**
 * 根据模板 key 从数据库获取模板
 */
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplate | null> {
  try {
    const rows = await query(
      "SELECT * FROM email_templates WHERE template_key = ? AND is_active = 1",
      [templateKey]
    ) as EmailTemplateRow[];

    if (rows.length === 0) return null;
    return parseTemplateRow(rows[0]);
  } catch (error) {
    console.error("[EmailTemplate] 获取模板失败:", error);
    return null;
  }
}

/**
 * 获取所有模板列表
 */
export async function listEmailTemplates(category?: TemplateCategory): Promise<EmailTemplate[]> {
  try {
    let sql = "SELECT * FROM email_templates";
    const params: any[] = [];

    if (category) {
      sql += " WHERE category = ?";
      params.push(category);
    }

    sql += " ORDER BY category, template_key";

    const rows = await query(sql, params) as EmailTemplateRow[];
    return rows.map(parseTemplateRow);
  } catch (error) {
    console.error("[EmailTemplate] 获取模板列表失败:", error);
    return [];
  }
}

/**
 * 使用模板发送邮件的渲染方法
 * 合并全局变量和传入数据，渲染主题、HTML 和纯文本
 */
export async function renderEmailTemplate(
  templateKey: string,
  data: Record<string, string>
): Promise<RenderedTemplate | null> {
  const template = await getEmailTemplate(templateKey);
  if (!template) {
    console.warn(`[EmailTemplate] 模板不存在或未启用: ${templateKey}`);
    return null;
  }

  // 合并全局变量（传入数据优先）
  const mergedData = { ...getGlobalVariableDefaults(), ...data };

  return {
    subject: renderTemplate(template.subject, mergedData),
    html: renderTemplate(template.body_html, mergedData),
    text: template.body_text ? renderTemplate(template.body_text, mergedData) : "",
  };
}

/**
 * 创建新模板
 */
export async function createEmailTemplate(params: {
  template_key: string;
  name: string;
  description?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  variables: TemplateVariable[];
  category: TemplateCategory;
}): Promise<number> {
  const result = await query(
    `INSERT INTO email_templates (template_key, name, description, subject, body_html, body_text, variables, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.template_key,
      params.name,
      params.description || null,
      params.subject,
      params.body_html,
      params.body_text || null,
      JSON.stringify(params.variables),
      params.category,
    ]
  );

  return (result as any).insertId;
}

/**
 * 更新模板
 */
export async function updateEmailTemplate(
  id: number,
  params: {
    name?: string;
    description?: string;
    subject?: string;
    body_html?: string;
    body_text?: string;
    variables?: TemplateVariable[];
    category?: TemplateCategory;
    is_active?: boolean;
  }
): Promise<boolean> {
  const fields: string[] = [];
  const values: any[] = [];

  if (params.name !== undefined) { fields.push("name = ?"); values.push(params.name); }
  if (params.description !== undefined) { fields.push("description = ?"); values.push(params.description); }
  if (params.subject !== undefined) { fields.push("subject = ?"); values.push(params.subject); }
  if (params.body_html !== undefined) { fields.push("body_html = ?"); values.push(params.body_html); }
  if (params.body_text !== undefined) { fields.push("body_text = ?"); values.push(params.body_text); }
  if (params.variables !== undefined) { fields.push("variables = ?"); values.push(JSON.stringify(params.variables)); }
  if (params.category !== undefined) { fields.push("category = ?"); values.push(params.category); }
  if (params.is_active !== undefined) { fields.push("is_active = ?"); values.push(params.is_active ? 1 : 0); }

  if (fields.length === 0) return false;

  values.push(id);
  const result = await query(
    `UPDATE email_templates SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return (result as any).affectedRows > 0;
}

/**
 * 删除模板（内置模板不可删除）
 */
export async function deleteEmailTemplate(id: number): Promise<boolean> {
  // 检查是否为内置模板
  const rows = await query("SELECT is_builtin FROM email_templates WHERE id = ?", [id]) as any[];
  if (rows.length === 0) return false;
  if (rows[0].is_builtin) return false;

  const result = await query("DELETE FROM email_templates WHERE id = ?", [id]);
  return (result as any).affectedRows > 0;
}