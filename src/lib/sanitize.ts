/**
 * 输入校验与 XSS 防护库
 * 使用 sanitize-html 对用户输入进行净化，防止 XSS 注入
 * 
 * 核心原则：
 * - 服务端存储前净化（最安全的防线）
 * - 前端 React 默认转义 HTML，但服务端仍需净化以防绕过
 * - 对不同输入类型使用不同净化策略
 */

import sanitizeHtml from "sanitize-html";

// === 通用净化配置 ===

/** 严格净化：仅保留纯文本，去除所有 HTML 标签和属性 */
const STRICT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],           // 不允许任何 HTML 标签
  allowedAttributes: {},     // 不允许任何属性
  disallowedTagsMode: "discard",  // 直接丢弃不允许的标签及其内容
  textFilter: (text) => text,     // 保留原始文本
};

/** 评论净化：允许基本格式标签（粗体、斜体、链接等），但过滤危险标签 */
const COMMENT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["b", "i", "em", "strong", "a", "br", "p", "code", "pre"],
  allowedAttributes: {
    a: ["href", "title"],    // 链接仅允许 href 和 title
  },
  allowedSchemes: ["http", "https", "mailto"],  // 仅允许安全协议
  disallowedTagsMode: "discard",
  textFilter: (text) => text,
};

/** 昵称净化：仅保留纯文本，限制长度 */
const NAME_OPTIONS: sanitizeHtml.IOptions = {
  ...STRICT_OPTIONS,
  textFilter: (text) => text.replace(/\s+/g, " ").trim(),  // 合并空白字符
};

// === 核心净化函数 ===

/**
 * 严格净化：去除所有 HTML，仅保留纯文本
 * 适用于：搜索关键词、URL 参数、简短描述等
 */
export function sanitizeStrict(input: string): string {
  if (!input) return "";
  const result = sanitizeHtml(input, STRICT_OPTIONS);
  // 去除多余空白
  return result.trim();
}

/**
 * 评论内容净化：允许基本格式标签
 * 适用于：评论、帖子内容等需要少量格式的文本
 */
export function sanitizeComment(input: string): string {
  if (!input) return "";
  return sanitizeHtml(input, COMMENT_OPTIONS).trim();
}

/**
 * 昵称/显示名净化：纯文本 + 长度限制
 * 适用于：用户昵称、分类名等
 */
export function sanitizeName(input: string, maxLength: number = 50): string {
  if (!input) return "";
  const result = sanitizeHtml(input, NAME_OPTIONS);
  return result.slice(0, maxLength).trim();
}

/**
 * 邮件净化：纯文本 + 基本格式验证
 */
export function sanitizeEmail(input: string): string {
  if (!input) return "";
  // 去除所有 HTML 和空白
  const result = sanitizeStrict(input);
  // 基本邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(result)) {
    return "";  // 格式不合法返回空
  }
  return result.toLowerCase();
}

/**
 * URL 参数净化：去除 HTML 和特殊字符
 * 适用于：search 参数、filter 参数等
 */
export function sanitizeQueryParam(input: string, maxLength: number = 200): string {
  if (!input) return "";
  const result = sanitizeStrict(input);
  return result.slice(0, maxLength).trim();
}

/**
 * SQL LIKE 参数净化：防止 LIKE 注入
 * 对 % 和 _ 等通配符进行转义
 */
export function sanitizeLikeParam(input: string): string {
  if (!input) return "";
  const clean = sanitizeStrict(input);
  // 转义 SQL LIKE 通配符
  return clean.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// === 批量净化工具 ===

/**
 * 净化对象中的指定字段
 * @param obj 原始对象
 * @param fields 字段净化配置 { fieldName: sanitizeFunction }
 */
export function sanitizeObject(
  obj: Record<string, any>,
  fields: Record<string, (input: string) => string>
): Record<string, any> {
  const result = { ...obj };
  for (const [field, sanitizer] of Object.entries(fields)) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = sanitizer(String(result[field]));
    }
  }
  return result;
}