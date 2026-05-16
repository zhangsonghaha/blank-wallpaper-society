/**
 * 邮件服务库
 * 支持 Resend（优先）和通用 SMTP 两种模式
 * 配置来源优先级：数据库 system_settings > 环境变量
 */

import { query } from "@/lib/db";

// === 邮件发送参数 ===
interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** 发送失败时是否抛出异常（默认 false，仅记录日志） */
  throwOnError?: boolean;
}

// === 邮件配置（从数据库或环境变量获取） ===
interface EmailConfig {
  enabled: boolean;
  provider: string;
  from: string;
  resendApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

// 配置缓存（5分钟过期）
let configCache: { config: EmailConfig; expiresAt: number } | null = null;
const CONFIG_TTL = 5 * 60 * 1000;

/**
 * 获取邮件配置：优先数据库，回退环境变量
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  // 检查缓存
  if (configCache && Date.now() < configCache.expiresAt) {
    return configCache.config;
  }

  // 从数据库读取
  let dbSettings: Record<string, string> = {};
  try {
    const rows = (await query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?, ?, ?, ?, ?, ?)",
      ["email_enabled", "email_provider", "email_from", "resend_api_key", "smtp_host", "smtp_port", "smtp_user", "smtp_pass"]
    )) as any[];
    rows.forEach((r: any) => {
      if (r.setting_value) dbSettings[r.setting_key] = r.setting_value;
    });
  } catch {
    // 数据库不可用时回退环境变量
  }

  const config: EmailConfig = {
    enabled: dbSettings.email_enabled === "1" || dbSettings.email_enabled === "true",
    provider: dbSettings.email_provider || process.env.EMAIL_PROVIDER || "resend",
    from: dbSettings.email_from || process.env.EMAIL_FROM || "noreply@imagegallery.app",
    resendApiKey: dbSettings.resend_api_key || process.env.RESEND_API_KEY || "",
    smtpHost: dbSettings.smtp_host || process.env.SMTP_HOST || "",
    smtpPort: Number(dbSettings.smtp_port || process.env.SMTP_PORT) || 587,
    smtpUser: dbSettings.smtp_user || process.env.SMTP_USER || "",
    smtpPass: dbSettings.smtp_pass || process.env.SMTP_PASS || "",
  };

  // 更新缓存
  configCache = { config, expiresAt: Date.now() + CONFIG_TTL };
  return config;
}

/**
 * 清除配置缓存（管理后台修改设置后调用）
 */
export function clearEmailConfigCache(): void {
  configCache = null;
}

// === 检查邮件服务是否已配置 ===
export async function isEmailConfigured(): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config.enabled) return false;
  if (config.provider === "resend") {
    return !!config.resendApiKey;
  }
  if (config.provider === "smtp") {
    return !!(config.smtpHost && config.smtpUser && config.smtpPass);
  }
  return false;
}

// === Resend 发送实现 ===
async function sendViaResend(params: SendEmailParams, config: EmailConfig): Promise<void> {
  const { Resend } = await import("resend");
  const resend = new Resend(config.resendApiKey);

  await resend.emails.send({
    from: config.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

// === SMTP 发送实现 ===
async function sendViaSmtp(params: SendEmailParams, config: EmailConfig): Promise<void> {
  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

// === 通用邮件发送（核心函数） ===
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { throwOnError = false, ...emailParams } = params;
  try {
    const config = await getEmailConfig();
    const configured = await isEmailConfigured();
    if (!configured) {
      console.warn("[Email] 邮件服务未配置或未启用，跳过发送");
      console.warn(`[Email] 当前配置: enabled=${config.enabled}, provider=${config.provider}, from=${config.from}`);
      return;
    }

    console.log(`[Email] 正在发送邮件到 ${emailParams.to}，提供商: ${config.provider}`);

    if (config.provider === "resend") {
      await sendViaResend(emailParams, config);
    } else if (config.provider === "smtp") {
      await sendViaSmtp(emailParams, config);
    } else {
      throw new Error(`未知的邮件提供商: ${config.provider}`);
    }

    console.log(`[Email] 邮件发送成功: ${emailParams.to}`);
  } catch (error) {
    console.error("[Email] 发送邮件失败:", error);
    if (throwOnError) throw error;
  }
}

// === 密码重置邮件 ===
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await sendEmail({
    to,
    throwOnError: true,
    subject: "重置您的密码 - 壁纸社区",
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
        </div>
        <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">重置您的密码</h2>
          <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
            我们收到了您的密码重置请求。请点击下方按钮重置密码：
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${resetUrl}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
              重置密码
            </a>
          </div>
          <p style="color:#999;font-size:14px;line-height:1.6;margin:16px 0 0;">
            如果按钮无法点击，请复制以下链接到浏览器打开：<br/>
            <a href="${resetUrl}" style="color:#0070f3;word-break:break-all;">${resetUrl}</a>
          </p>
          <p style="color:#999;font-size:14px;line-height:1.6;margin:16px 0 0;">
            此链接将在 1 小时后过期。如果您没有请求重置密码，请忽略此邮件。
          </p>
        </div>
        <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
          <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
          <p style="margin:4px 0 0;">© ${new Date().getFullYear()} 壁纸社区 ${baseUrl}</p>
        </div>
      </div>
    `,
    text: `重置您的密码\n\n请访问以下链接重置密码：${resetUrl}\n\n此链接将在 1 小时后过期。如果您没有请求重置密码，请忽略此邮件。`,
  });
}

// === 欢迎注册邮件 ===
export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await sendEmail({
    to,
    subject: `欢迎加入壁纸社区，${name}！`,
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
        </div>
        <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">欢迎加入，${name}！🎉</h2>
          <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
            感谢您注册壁纸社区！在这里您可以：
          </p>
          <ul style="color:#666;font-size:16px;line-height:2;margin:0 0 24px;padding-left:20px;">
            <li>上传和分享精美壁纸</li>
            <li>浏览和收藏海量高清壁纸</li>
            <li>关注其他创作者，获取最新作品</li>
            <li>参与社区互动，解锁成就</li>
          </ul>
          <div style="text-align:center;margin:24px 0;">
            <a href="${baseUrl}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
              开始探索
            </a>
          </div>
        </div>
        <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
          <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
          <p style="margin:4px 0 0;">© ${new Date().getFullYear()} 壁纸社区 ${baseUrl}</p>
        </div>
      </div>
    `,
    text: `欢迎加入壁纸社区，${name}！\n\n感谢您注册壁纸社区！您可以上传和分享精美壁纸、浏览和收藏海量高清壁纸、关注其他创作者以及参与社区互动。\n\n开始探索：${baseUrl}`,
  });
}

// === 审核结果通知邮件 ===
export async function sendReviewResultEmail(
  to: string,
  imageName: string,
  status: "approved" | "rejected",
  reason?: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const isApproved = status === "approved";

  await sendEmail({
    to,
    subject: isApproved
      ? `壁纸审核通过：${imageName}`
      : `壁纸审核未通过：${imageName}`,
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
        </div>
        <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
          <h2 style="color:${isApproved ? "#16a34a" : "#dc2626"};font-size:20px;margin:0 0 16px;">
            ${isApproved ? "✅ 审核通过" : "❌ 审核未通过"}
          </h2>
          <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px;">
            您上传的壁纸「<strong>${imageName}</strong>」${isApproved ? "已通过审核，现在可以在社区中展示！" : "未通过审核。"}
          </p>
          ${
            !isApproved && reason
              ? `<p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px;">原因：${reason}</p>`
              : ""
          }
          ${
            !isApproved
              ? `<p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 16px;">请检查图片是否符合社区规范，修改后可重新提交。</p>`
              : ""
          }
          <div style="text-align:center;margin:24px 0;">
            <a href="${baseUrl}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
              ${isApproved ? "查看我的壁纸" : "重新上传"}
            </a>
          </div>
        </div>
        <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
          <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
          <p style="margin:4px 0 0;">© ${new Date().getFullYear()} 壁纸社区 ${baseUrl}</p>
        </div>
      </div>
    `,
    text: isApproved
      ? `壁纸审核通过：${imageName}\n\n您上传的壁纸「${imageName}」已通过审核，现在可以在社区中展示！\n\n查看我的壁纸：${baseUrl}`
      : `壁纸审核未通过：${imageName}\n\n您上传的壁纸「${imageName}」未通过审核。${reason ? `原因：${reason}` : "请检查图片是否符合社区规范。"}\n\n重新上传：${baseUrl}`,
  });
}

// === 通用通知邮件（用于 notification.ts 邮件分支） ===
export async function sendNotificationEmail(
  to: string,
  title: string,
  content: string
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await sendEmail({
    to,
    subject: `${title} - 壁纸社区`,
    html: `
      <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
        </div>
        <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">${title}</h2>
          <p style="color:#666;font-size:16px;line-height:1.6;margin:0;">
            ${content}
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${baseUrl}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
              查看详情
            </a>
          </div>
        </div>
        <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
          <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
          <p style="margin:4px 0 0;">© ${new Date().getFullYear()} 壁纸社区 ${baseUrl}</p>
        </div>
      </div>
    `,
    text: `${title}\n\n${content}\n\n查看详情：${baseUrl}`,
  });
}