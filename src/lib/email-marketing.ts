/**
 * 邮件营销核心库
 * 营销活动管理、订阅偏好、发送与统计
 */

import { db } from "@/lib/db";
import { sql } from "kysely";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import crypto from "crypto";

// === 订阅偏好操作 ===

/** 确保用户有订阅记录（注册/首次发送时调用） */
export async function ensureSubscription(userId: number, email: string) {
  const existing = await db.selectFrom("email_subscriptions")
    .where("user_id", "=", userId)
    .where("email", "=", email)
    .select("id")
    .execute();

  if (existing.length > 0) return existing[0];

  const unsubToken = crypto.randomBytes(32).toString("hex");
  const result = await db.insertInto("email_subscriptions")
    .values({
      user_id: userId,
      email,
      unsub_token: unsubToken,
      weekly_digest: 1,
      activity_notice: 1,
      creator_update: 0,
    })
    .executeTakeFirst();
  return { id: Number(result.insertId) };
}

/** 获取用户订阅偏好 */
export async function getSubscription(userId: number) {
  const rows = await db.selectFrom("email_subscriptions")
    .where("user_id", "=", userId)
    .selectAll()
    .limit(1)
    .execute();
  return rows[0] || null;
}

/** 通过退订token获取订阅记录 */
export async function getSubscriptionByToken(token: string) {
  const rows = await db.selectFrom("email_subscriptions")
    .where("unsub_token", "=", token)
    .selectAll()
    .execute();
  return rows[0] || null;
}

/** 更新订阅偏好 */
export async function updateSubscription(userId: number, prefs: {
  weekly_digest?: boolean;
  activity_notice?: boolean;
  creator_update?: boolean;
  is_unsubscribed?: boolean;
}) {
  const fields: Record<string, unknown> = {};
  if (prefs.weekly_digest !== undefined) fields.weekly_digest = prefs.weekly_digest ? 1 : 0;
  if (prefs.activity_notice !== undefined) fields.activity_notice = prefs.activity_notice ? 1 : 0;
  if (prefs.creator_update !== undefined) fields.creator_update = prefs.creator_update ? 1 : 0;
  if (prefs.is_unsubscribed !== undefined) fields.is_unsubscribed = prefs.is_unsubscribed ? 1 : 0;
  if (Object.keys(fields).length === 0) return;
  await db.updateTable("email_subscriptions")
    .set(fields as any)
    .where("user_id", "=", userId)
    .execute();
}

/** 全局退订 */
export async function unsubscribeAll(token: string) {
  const sub = await getSubscriptionByToken(token);
  if (!sub) return false;
  await db.updateTable("email_subscriptions")
    .set({
      is_unsubscribed: 1,
      unsubscribed_at: sql`NOW()`,
      weekly_digest: 0,
      activity_notice: 0,
      creator_update: 0,
    })
    .where("id", "=", sub.id)
    .execute();
  return true;
}

/** 按类型退订 */
export async function unsubscribeByType(token: string, type: 'weekly_digest' | 'activity_notice' | 'creator_update') {
  const sub = await getSubscriptionByToken(token);
  if (!sub) return false;
  await db.updateTable("email_subscriptions")
    .set({ [type]: 0 } as any)
    .where("id", "=", sub.id)
    .execute();
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
  const result = await db.insertInto("email_campaigns")
    .values({
      subject: data.subject,
      template_key: data.templateKey || null,
      body_html: data.bodyHtml,
      body_text: data.bodyText || null,
      campaign_type: data.campaignType,
      status: "draft",
      scheduled_at: data.scheduledAt ? new Date(data.scheduledAt) : null,
      created_by: data.createdBy || null,
    })
    .executeTakeFirst();
  return Number(result.insertId);
}

/** 更新营销活动 */
export async function updateCampaign(id: number, data: {
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  scheduledAt?: string;
  status?: string;
}) {
  const fields: Record<string, unknown> = {};
  if (data.subject !== undefined) fields.subject = data.subject;
  if (data.bodyHtml !== undefined) fields.body_html = data.bodyHtml;
  if (data.bodyText !== undefined) fields.body_text = data.bodyText;
  if (data.scheduledAt !== undefined) fields.scheduled_at = data.scheduledAt;
  if (data.status !== undefined) fields.status = data.status;
  if (Object.keys(fields).length === 0) return;
  await db.updateTable("email_campaigns")
    .set(fields as any)
    .where("id", "=", id)
    .execute();
}

/** 获取营销活动列表 */
export async function getCampaigns(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const countResult = await db.selectFrom("email_campaigns")
    .select((eb) => eb.fn.countAll().as("total"))
    .executeTakeFirst();
  const total = Number(countResult?.total || 0);
  const rows = await db.selectFrom("email_campaigns")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();
  return { data: rows, total };
}

/** 获取营销活动详情 */
export async function getCampaign(id: number) {
  const rows = await db.selectFrom("email_campaigns")
    .where("id", "=", id)
    .selectAll()
    .execute();
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
  const campaignType = campaign.campaign_type as string;
  const subscribers = await db.selectFrom("email_subscriptions as es")
    .select(["es.user_id", "es.email", "es.unsub_token"])
    .where("es.is_unsubscribed", "=", 0)
    .where(sql<boolean>`(
      (es.weekly_digest = 1 AND ${campaignType} = 'weekly_digest')
      OR (es.activity_notice = 1 AND ${campaignType} = 'activity_notice')
      OR (es.creator_update = 1 AND ${campaignType} = 'creator_update')
      OR (${campaignType} = 'system')
    )`)
    .execute();

  // 更新活动状态
  await db.updateTable("email_campaigns")
    .set({ status: "sending", target_count: subscribers.length, sent_count: 0 })
    .where("id", "=", campaignId)
    .execute();

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
      await db.insertInto("email_campaign_logs")
        .values({ campaign_id: campaignId, user_id: sub.user_id, email: sub.email, status: "sent" })
        .execute();

      sentCount++;
      // 每10封更新一次进度
      if (sentCount % 10 === 0) {
        await db.updateTable("email_campaigns")
          .set({ sent_count: sentCount })
          .where("id", "=", campaignId)
          .execute();
      }
    } catch (error: any) {
      await db.insertInto("email_campaign_logs")
        .values({
          campaign_id: campaignId,
          user_id: sub.user_id,
          email: sub.email,
          status: "failed",
          error_message: error.message?.substring(0, 500) ?? null,
        })
        .execute();
    }
  }

  // 更新最终状态
  await db.updateTable("email_campaigns")
    .set({ status: "completed", sent_count: sentCount, sent_at: sql`NOW()` })
    .where("id", "=", campaignId)
    .execute();

  return { sentCount, totalSubscribers: subscribers.length };
}

/** 生成每周精选邮件内容 */
export async function generateWeeklyDigestHtml(): Promise<{ subject: string; html: string; text: string }> {
  // 获取本周热门壁纸
  const topImages = await db.selectFrom("images")
    .select(["id", "title", "url", "thumbnail_url", "view_count", "download_count"])
    .where("status", "=", "approved")
    .where("media_type", "!=", "video")
    .where("created_at", ">=", sql<Date>`DATE_SUB(NOW(), INTERVAL 7 DAY)`)
    .orderBy("download_count", "desc")
    .orderBy("view_count", "desc")
    .limit(6)
    .execute();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const imageCards = topImages.map((img) => `
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

  const text = `本周精选壁纸\n\n${topImages.map((img) => `- ${img.title} (${img.download_count}下载)`).join("\n")}\n\n查看更多: ${baseUrl}`;

  return {
    subject: "本周精选壁纸 - 壁纸社区",
    html,
    text,
  };
}