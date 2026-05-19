import { query } from "@/lib/db";
import { isEmailConfigured, sendNotificationEmail } from "@/lib/email";
import { pushBotNotification } from "@/lib/bot-notification";
import { triggerWebhookAsync } from "@/lib/webhook";

// === 通知类型定义 ===
export type NotificationType =
  | "system"
  | "like"
  | "comment"
  | "review"
  | "follow"
  | "achievement"
  | "favorite"
  | "order";

export type RelatedType =
  | "image"
  | "user"
  | "collection"
  | "report"
  | "achievement";

// === 通知类型映射 ===
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  system: "系统",
  like: "点赞",
  comment: "评论",
  review: "审核",
  follow: "关注",
  achievement: "成就",
  favorite: "收藏",
  order: "订单",
};

export const NOTIFICATION_TYPE_ICONS: Record<string, string> = {
  system: "🔔",
  like: "❤️",
  comment: "💬",
  review: "✅",
  follow: "👤",
  achievement: "🏆",
  favorite: "⭐",
  order: "💰",
};

// === 获取用户通知设置 ===
export async function getNotificationSettings(
  userId: number
): Promise<Record<string, number>> {
  const rows = await query(
    "SELECT * FROM notification_settings WHERE user_id = ?",
    [userId]
  ) as any[];
  if (rows.length === 0) {
    // 默认全部开启
    return {
      notify_system: 1,
      notify_like: 1,
      notify_comment: 1,
      notify_review: 1,
      notify_follow: 1,
      notify_achievement: 1,
      notify_favorite: 1,
      email_system: 0,
      email_review: 1,
      email_achievement: 1,
    };
  }
  return rows[0];
}

// === 检查用户是否允许接收某类型通知 ===
async function isNotificationEnabled(
  userId: number,
  type: NotificationType
): Promise<boolean> {
  const settings = await getNotificationSettings(userId);
  const key = `notify_${type}`;
  return settings[key] !== 0;
}

// === 推送通知（核心方法） ===
export async function pushNotification(params: {
  userId: number;
  type: NotificationType;
  title: string;
  content?: string;
  relatedId?: number;
  relatedType?: RelatedType;
}): Promise<number | null> {
  try {
    // 检查用户通知设置
    const enabled = await isNotificationEnabled(params.userId, params.type);
    if (!enabled) {
      return null; // 用户关闭了该类型通知
    }

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, content, related_id, related_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        params.userId,
        params.type,
        params.title,
        params.content || null,
        params.relatedId || null,
        params.relatedType || null,
      ]
    );

    const insertId = (result as any).insertId;

    // 如果邮件服务已配置且用户开启了该类型的邮件通知，发送邮件
    if (await isEmailConfigured()) {
      const settings = await getNotificationSettings(params.userId);
      if (settings[`email_${params.type}`]) {
        // 获取用户邮箱
        const userRows = await query("SELECT email FROM users WHERE id = ?", [
          params.userId,
        ]) as any[];
        if (userRows.length > 0) {
          sendNotificationEmail(
            userRows[0].email,
            params.title,
            params.content || ""
          ).catch((err) => {
            console.error("[Notification] 发送通知邮件失败:", err);
          });
        }
      }
    }

    // 机器人通知推送（飞书/QQ/钉钉等）
    await pushBotNotification({
      type: params.type,
      title: params.title,
      content: params.content,
    });

    return insertId;
  } catch (error) {
    console.error("pushNotification error:", error);
    return null;
  }
}

// === 批量推送通知（如审核结果通知多张图片） ===
export async function pushNotificationBatch(
  items: Array<{
    userId: number;
    type: NotificationType;
    title: string;
    content?: string;
    relatedId?: number;
    relatedType?: RelatedType;
  }>
): Promise<void> {
  for (const item of items) {
    await pushNotification(item);
  }
}

// === 成就解锁通知 ===
export async function notifyAchievementUnlocked(
  userId: number,
  achievementName: string,
  achievementId: number,
  expReward: number
): Promise<void> {
  await pushNotification({
    userId,
    type: "achievement",
    title: `🏆 成就解锁：${achievementName}`,
    content: `恭喜解锁成就「${achievementName}」，获得 ${expReward} 经验值！`,
    relatedId: achievementId,
    relatedType: "achievement",
  });
}

// === 图片审核结果通知 ===
export async function notifyReviewResult(
  userId: number,
  imageTitle: string,
  imageId: number,
  approved: boolean,
  reason?: string
): Promise<void> {
  await pushNotification({
    userId,
    type: "review",
    title: approved ? `✅ 图片审核通过：${imageTitle}` : `❌ 图片审核未通过：${imageTitle}`,
    content: approved
      ? `您上传的壁纸「${imageTitle}」已通过审核，现在可以在社区中展示！`
      : `您上传的壁纸「${imageTitle}」未通过审核。${reason ? `原因：${reason}` : "请检查图片是否符合社区规范。"}`,
    relatedId: imageId,
    relatedType: "image",
  });

  // 触发 Webhook 事件
  triggerWebhookAsync(
    approved ? "image.approved" : "image.rejected",
    { imageId, imageTitle, userId, approved, reason }
  );
}

// === 新关注通知 ===
export async function notifyNewFollower(
  userId: number,
  followerName: string,
  followerId: number
): Promise<void> {
  await pushNotification({
    userId,
    type: "follow",
    title: `👤 新粉丝：${followerName}`,
    content: `${followerName} 关注了你`,
    relatedId: followerId,
    relatedType: "user",
  });

  // 触发 Webhook 事件
  triggerWebhookAsync("user.followed", { userId, followerId, followerName });
}

// === 新收藏通知 ===
export async function notifyNewFavorite(
  userId: number,
  userName: string,
  imageTitle: string,
  imageId: number
): Promise<void> {
  await pushNotification({
    userId,
    type: "favorite",
    title: `⭐ 你的壁纸被收藏`,
    content: `${userName} 收藏了你的壁纸「${imageTitle}」`,
    relatedId: imageId,
    relatedType: "image",
  });
}

// === 评论回复通知 ===
export async function notifyCommentReply(
  userId: number,
  commenterName: string,
  imageTitle: string,
  imageId: number
): Promise<void> {
  await pushNotification({
    userId,
    type: "comment",
    title: `💬 新评论：${imageTitle}`,
    content: `${commenterName} 评论了壁纸「${imageTitle}」`,
    relatedId: imageId,
    relatedType: "image",
  });

  // 触发 Webhook 事件
  triggerWebhookAsync("comment.created", { imageId, imageTitle, commenterName, userId });
}

// === 新订单通知（通知管理员） ===
export async function notifyNewOrder(params: {
  orderId: number;
  orderNo: string;
  orderType: "paid_wallpaper" | "tip" | "membership";
  amount: number;
  buyerName?: string;
  description?: string;
}): Promise<void> {
  const typeLabels: Record<string, string> = {
    paid_wallpaper: "付费壁纸",
    tip: "打赏",
    membership: "会员订阅",
  };

  const content = `订单号：${params.orderNo}\n类型：${typeLabels[params.orderType] || params.orderType}\n金额：¥${params.amount.toFixed(2)}${params.buyerName ? `\n买家：${params.buyerName}` : ""}${params.description ? `\n商品：${params.description}` : ""}\n\n请尽快在后台确认支付`;

  // 1. 推送机器人通知（飞书/QQ/钉钉等，订阅了 order 事件的机器人）
  await pushBotNotification({
    type: "order",
    title: `💰 新订单待确认：¥${params.amount.toFixed(2)}`,
    content,
  });

  // 2. 通知所有管理员（站内通知 + 邮件）
  const adminRows = await query(
    "SELECT id FROM users WHERE role = 'admin'"
  ) as any[];

  for (const admin of adminRows) {
    await pushNotification({
      userId: admin.id,
      type: "order",
      title: `💰 新订单待确认：¥${params.amount.toFixed(2)}`,
      content,
      relatedId: params.orderId,
      relatedType: "image", // 暂用 image 类型，订单没有独立 relatedType
    });
  }

  // 3. 触发 Webhook 事件
  triggerWebhookAsync("order.created", {
    orderId: params.orderId,
    orderNo: params.orderNo,
    orderType: params.orderType,
    amount: params.amount,
    buyerName: params.buyerName,
    description: params.description,
  });
}