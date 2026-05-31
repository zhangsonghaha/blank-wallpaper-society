/**
 * 邮件营销核心库
 * 营销活动管理、订阅偏好、发送与统计
 */

import { query } from "@/lib/db";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import crypto from "crypto";

// === 订阅偏好操作 ===

/** 确保用户有订阅记录（注册/首次发送时调用） */
export async function ensureSubscription(userId: number, email: string) {
  const existing = (await query(
    "SELECT id FROM email_subscriptions WHERE user_id = ? AND email = ?",
    [userId, email]
  )) as any[];

  if (existing.length > 0) return existing[0];

  const unsubToken = crypto.randomBytes(32).toString("hex");
  const result = await query(
    `INSERT INTO email_subscriptions (user_id, email, unsub_token, weekly_digest, activity_notice, creator_update)
     VALUES (?, ?, ?, 1, 1, 0)`,
    [userId, email, unsubToken]
  );
  return { id: (result as any).insertId };
}

/** 获取用户订阅偏好 */
export async function getSubscription(userId: number) {
  const rows = (await query(
    "SELECT * FROM email_subscriptions WHERE user_id = ? LIMIT 1",
    [userId]
  )) as any[];
  return rows[0] || null;
}

/** 通过退订token获取订阅记录 */
export async function getSubscriptionByToken(token: string) {
  const rows = (await query(
    "SELECT * FROM email_subscriptions WHERE unsub_token = ?",
    [token]
  )) as any[];
  return rows[0] || null;
}

/** 更新订阅偏好 */
export async function updateSubscription(userId: number, prefs: {
  weekly_digest?: boolean;
  activity_notice?: boolean;
  creator_update?: boolean;
  is_unsubscribed?: boolean;
}) {
  const sets: string[] = [];
  const params: any[] = [];
  if (prefs.weekly_digest !== undefined) { sets.push("weekly_digest = ?"); params.push(prefs.weekly_digest ? 1 : 0); }
  if (prefs.activity_notice !== undefined) { sets.push("activity_notice = ?"); params.push(prefs.activity_notice ? 1 : 0); }
  if (prefs.creator_update !== undefined) { sets.push("creator_update = ?"); params.push(prefs.creator_update ? 1 : 0); }
  if (prefs.is_unsubscribed !== undefined) { sets.push("is_unsubscribed = ?"); params.push(prefs.is_unsubscribed ? 1 : 0); }
  if (sets.length === 0) return;
  params.push(userId);
  await query(`UPDATE email_subscriptions SET ${sets.join(", ")} WHERE user_id = ?`, params);
}

/** 全局退订 */
export async function unsubscribeAll(token: string) {
  const sub = await getSubscriptionByToken(token);
  if (!sub) return false;
  await query(
    "UPDATE email_subscriptions SET is_unsubscribed = 1, unsubscribed_at = NOW(), weekly_digest = 0, activity_notice = 0, creator_update = 0 WHERE id = ?",
    [sub.id]
  );
  return true;
}

/** 按类型退订 */
export async function unsubscribeByType(token: string, type: 'weekly_digest' | 'activity_notice' | 'creator_update') {
  const sub = await getSubscriptionByToken(token);
  if (!sub) return false;
  await query(
    `UPDATE email_subscriptions SET ${type} = 0 WHERE id = ?`,
    [sub.id]
  );
  return true;
}

// === 营销活动操作 ===

/** 创建营销活动 */
export async function createCampaign(data: {
  subject: string;
  templateKey?: string;
  bodyHtml: string;
  bodyText?: string;
  campaignType: 'weekly_digest' | 'activity_notice' | 'creator_update' | 'system';
  scheduledAt?: string;
  createdBy?: number;
}) {
  const result = await query(
    `INSERT INTO email_campaigns (subject, template_key, body_html, body_text, campaign_type, status, scheduled_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [data.subject, data.templateKey || null, data.bodyHtml, data.bodyText || null, data.campaignType, data.scheduledAt || null, data.createdBy || null]
  );
  return (result as any).insertId;
}

/** 更新营销活动 */
export async function updateCampaign(id: number, data: {
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  scheduledAt?: string;
  status?: string;
}) {
  const sets: string[] = [];
  const params: any[] = [];
  if (data.subject !== undefined) { sets.push("subject = ?"); params.push(data.subject); }
  if (data.bodyHtml !== undefined) { sets.push("body_html = ?"); params.push(data.bodyHtml); }
  if (data.bodyText !== undefined) { sets.push("body_text = ?"); params.push(data.bodyText); }
  if (data.scheduledAt !== undefined) { sets.push("scheduled_at = ?"); params.push(data.scheduledAt); }
  if (data.status !== undefined) { sets.push("status = ?"); params.push(data.status); }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE email_campaigns SET ${sets.join(", ")} WHERE id = ?`, params);
}

/** 获取营销活动列表 */
export async function getCampaigns(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [countResult] = (await query("SELECT COUNT(*) as total FROM email_campaigns")) as any[];
  const rows = (await query(
    "SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset]
  )) as any[];
  return { data: rows, total: countResult?.total || 0 };
}

/** 获取营销活动详情 */
export async function getCampaign(id: number) {
  const rows = (await query("SELECT * FROM email_campaigns WHERE id = ?", [id])) as any[];
  return rows[0] || null;
}

/** 发送营销活动 */
export async function sendCampaign(campaignId: number) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("活动不存在");
  if (campaign.status === "sending" || campaign.status === "completed") {
    throw new Error("活动已在发送中或已完成");
  }

  const configured = await isEmailConfigured();
  if (!configured) throw new Error("邮件服务未配置");

  // 获取目标订阅者
  const subscribers = (await query(
    `SELECT es.user_id, es.email, es.unsub_token
     FROM email_subscriptions es
     WHERE es.is_unsubscribed = 0
       AND (
         (es.weekly_digest = 1 AND ? = 'weekly_digest')
         OR (es.activity_notice = 1 AND ? = 'activity_notice')
         OR (es.creator_update = 1 AND ? = 'creator_update')
         OR (? = 'system')
       )`,
    [campaign.campaign_type, campaign.campaign_type, campaign.campaign_type, campaign.campaign_type]
  )) as any[];

  // 更新活动状态
  await query(
    "UPDATE email_campaigns SET status = 'sending', target_count = ?, sent_count = 0 WHERE id = ?",
    [subscribers.length, campaignId]
  );

  let sentCount = 0;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // 逐个发送（避免被限流）
  for (const sub of subscribers) {
    try {
      // 在邮件底部添加退订链接
      const unsubUrl = `${baseUrl}/unsubscribe?token=${sub.unsub_token}&type=${campaign.campaign_type}`;
      const trackingPixel = `<img src="${baseUrl}/api/email-marketing/track?campaign=${campaignId}&user=${sub.user_id}&action=open" width="1" height="1" alt="" />`;
      const htmlWithTracking = campaign.body_html.replace(
        "</body>",
        `${trackingPixel}</body>`
      ).replace(
        "</html>",
        `${trackingPixel}</html>`
      );
      const htmlWithUnsub = htmlWithTracking + `
        <div style="text-align:center;padding:20px;color:#999;font-size:12px;border-top:1px solid #eee;margin-top:32px;">
          <p>不想再收到此类邮件？<a href="${unsubUrl}" style="color:#666;">取消订阅</a></p>
        </div>
      `;

      await sendEmail({
        to: sub.email,
        subject: campaign.subject,
        html: htmlWithUnsub,
        text: campaign.body_text || undefined,
      });

      // 记录发送日志
      await query(
        "INSERT INTO email_campaign_logs (campaign_id, user_id, email, status) VALUES (?, ?, ?, 'sent')",
        [campaignId, sub.user_id, sub.email]
      );

      sentCount++;
      // 每10封更新一次进度
      if (sentCount % 10 === 0) {
        await query("UPDATE email_campaigns SET sent_count = ? WHERE id = ?", [sentCount, campaignId]);
      }
    } catch (error: any) {
      await query(
        "INSERT INTO email_campaign_logs (campaign_id, user_id, email, status, error_message) VALUES (?, ?, ?, 'failed', ?)",
        [campaignId, sub.user_id, sub.email, error.message?.substring(0, 500)]
      );
    }
  }

  // 更新最终状态
  await query(
    "UPDATE email_campaigns SET status = 'completed', sent_count = ?, sent_at = NOW() WHERE id = ?",
    [sentCount, campaignId]
  );

  return { sentCount, totalSubscribers: subscribers.length };
}

/** 生成每周精选邮件内容 */
export async function generateWeeklyDigestHtml(): Promise<{ subject: string; html: string; text: string }> {
  // 获取本周热门壁纸
  const topImages = (await query(
    `SELECT id, title, url, thumbnail_url, view_count, download_count
     FROM images WHERE status = 'approved' AND media_type != 'video'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY download_count DESC, view_count DESC LIMIT 6`
  )) as any[];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const imageCards = topImages.map((img: any) => `
    <div style="display:inline-block;width:31%;margin:1%;vertical-align:top;">
      <a href="${baseUrl}/images/${img.id}" style="text-decoration:none;">
        <img src="${img.thumbnail_url || img.url}" alt="${img.title}" style="width:100%;border-radius:8px;" />
        <p style="color:#333;font-size:13px;margin:8px 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${img.title}</p>
        <p style="color:#999;font-size:11px;margin:0;">${img.download_count} 下载 · ${img.view_count} 浏览</p>
      </a>
    </div>
  `).join("");

  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#1a1a1a;font-size:22px;margin:0;">本周精选壁纸</h1>
        <p style="color:#999;font-size:14px;margin:8px 0 0;">为你精选本周最热门的壁纸</p>
      </div>
      <div style="text-align:center;">
        ${imageCards || '<p style="color:#999;">本周暂无新壁纸</p>'}
      </div>
      <div style="text-align:center;margin-top:32px;">
        <a href="${baseUrl}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
          查看更多壁纸
        </a>
      </div>
    </div>
  `;

  const text = `本周精选壁纸\n\n${topImages.map((img: any) => `- ${img.title} (${img.download_count}下载)`).join("\n")}\n\n查看更多: ${baseUrl}`;

  return {
    subject: "本周精选壁纸 - 壁纸社区",
    html,
    text,
  };
}