/**
 * 私信系统核心库
 * 
 * 提供对话管理和消息发送/获取功能
 * 使用 Redis pub/sub 实现跨实例实时消息推送
 */

import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";
import Redis from "ioredis";
import redis from "@/lib/redis";
import { sanitizeStrict } from "@/lib/sanitize";

// === 类型定义 ===

export interface Conversation {
  id: number;
  created_at: string;
  updated_at: string;
  // 关联数据（通过JOIN获取）
  other_user_id?: number;
  other_user_name?: string;
  other_user_avatar?: string;
  last_message_id?: number;
  last_message_content?: string;
  last_message_sender_id?: number;
  last_message_created_at?: string;
  unread_count?: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: "text" | "image" | "system";
  is_read: number;
  created_at: string;
  // 关联数据
  sender_name?: string;
  sender_avatar?: string;
}

// === Redis Pub/Sub 频道 ===
// 消息推送频道: pm:{userId} — 用于向特定用户推送新消息
const PM_CHANNEL_PREFIX = "pm:";

// === 创建或获取对话 ===
// 两个用户之间只允许有一个对话
export async function createOrGetConversation(
  userId1: number,
  userId2: number
): Promise<number> {
  // 不能和自己对话
  if (userId1 === userId2) {
    throw new Error("不能和自己发起对话");
  }

  // 查找是否已有对话
  const existing = await query(
    `SELECT c.id FROM conversations c
     INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
     INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
     WHERE cp1.is_hidden = 0 AND cp2.is_hidden = 0
     LIMIT 1`,
    [userId1, userId2]
  ) as any[];

  if (existing.length > 0) {
    return existing[0].id;
  }

  // 创建新对话（事务保证一致性）
  const conversationId = await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      "INSERT INTO conversations () VALUES ()"
    );
    const convId = (result as any).insertId;

    await conn.execute(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)",
      [convId, userId1, convId, userId2]
    );

    return convId;
  });

  return conversationId;
}

// === 发送消息 ===
export async function sendMessage(
  senderId: number,
  conversationId: number,
  content: string,
  messageType: "text" | "image" = "text"
): Promise<Message> {
  // 验证用户是否属于该对话
  const participants = await query(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = ?",
    [conversationId]
  ) as any[];

  const isParticipant = participants.some((p: any) => p.user_id === senderId);
  if (!isParticipant) {
    throw new Error("你不是该对话的参与者");
  }

  // 内容清理
  const cleanContent = messageType === "text" 
    ? sanitizeStrict(content) // 纯文本，去除所有HTML
    : content; // 图片URL不做清理

  // 限制内容长度
  if (cleanContent.length > 2000) {
    throw new Error("消息内容不能超过2000字");
  }

  // 插入消息并更新对话时间
  const result = await withTransaction(async (conn) => {
    const [msgResult] = await conn.execute(
      "INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES (?, ?, ?, ?)",
      [conversationId, senderId, cleanContent, messageType]
    );

    // 更新对话的 updated_at（触发 ON UPDATE）
    await conn.execute(
      "UPDATE conversations SET updated_at = NOW() WHERE id = ?",
      [conversationId]
    );

    // 对其他参与者取消隐藏（如果之前隐藏了）
    await conn.execute(
      "UPDATE conversation_participants SET is_hidden = 0 WHERE conversation_id = ? AND user_id != ? AND is_hidden = 1",
      [conversationId, senderId]
    );

    const msgId = (msgResult as any).insertId;

    // 获取完整消息
    const [rows] = await conn.execute(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [msgId]
    );

    return (rows as any[])[0];
  });

  // 通过 Redis pub/sub 推送消息给其他参与者
  const otherUserIds = participants
    .filter((p: any) => p.user_id !== senderId)
    .map((p: any) => p.user_id);

  for (const otherId of otherUserIds) {
    try {
      await redis.publish(
        PM_CHANNEL_PREFIX + otherId,
        JSON.stringify({
          type: "new_message",
          conversationId,
          message: result,
        })
      );
    } catch (err) {
      console.error("[PM] Redis publish error:", err);
      // Redis推送失败不影响消息保存
    }
  }

  return result as Message;
}

// === 获取对话列表 ===
export async function getConversations(
  userId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ data: Conversation[]; total: number }> {
  const offset = (page - 1) * limit;

  // 获取用户参与的对话（未隐藏的）
  const totalResult = await query(
    `SELECT COUNT(*) as total FROM conversation_participants 
     WHERE user_id = ? AND is_hidden = 0`,
    [userId]
  ) as any[];
  const total = totalResult[0]?.total || 0;

  const rows = await query(
    `SELECT 
      c.id, c.created_at, c.updated_at,
      other_p.user_id as other_user_id,
      other_u.name as other_user_name,
      other_u.avatar as other_user_avatar,
      last_msg.content as last_message_content,
      last_msg.sender_id as last_message_sender_id,
      last_msg.created_at as last_message_created_at,
      unread.unread_count
    FROM conversations c
    INNER JOIN conversation_participants my_p ON c.id = my_p.conversation_id AND my_p.user_id = ? AND my_p.is_hidden = 0
    INNER JOIN conversation_participants other_p ON c.id = other_p.conversation_id AND other_p.user_id != ?
    INNER JOIN users other_u ON other_p.user_id = other_u.id
    LEFT JOIN messages last_msg ON c.id = last_msg.conversation_id 
      AND last_msg.id = (SELECT MAX(id) FROM messages WHERE conversation_id = c.id)
    LEFT JOIN (
      SELECT conversation_id, COUNT(*) as unread_count 
      FROM messages 
      WHERE is_read = 0 AND sender_id != ? 
      AND conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = ?)
      GROUP BY conversation_id
    ) unread ON c.id = unread.conversation_id
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?`,
    [userId, userId, userId, userId, limit, offset]
  ) as any[];

  return { data: rows as Conversation[], total };
}

// === 获取对话中的消息 ===
export async function getMessages(
  userId: number,
  conversationId: number,
  page: number = 1,
  limit: number = 50,
  beforeId?: number
): Promise<{ data: Message[]; total: number }> {
  // 验证用户属于该对话
  const participant = await query(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  ) as any[];

  if (participant.length === 0) {
    throw new Error("你不是该对话的参与者");
  }

  // 标记所有对方消息为已读
  await query(
    `UPDATE messages SET is_read = 1 
     WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`,
    [conversationId, userId]
  );

  // 更新用户的最后已读时间
  await query(
    "UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );

  // 获取消息总数
  const totalResult = await query(
    "SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?",
    [conversationId]
  ) as any[];
  const total = totalResult[0]?.total || 0;

  // 获取消息（支持游标加载，beforeId用于向上翻页）
  let sql = `
    SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
  `;
  const params: any[] = [conversationId];

  if (beforeId) {
    sql += " AND m.id < ?";
    params.push(beforeId);
  }

  sql += " ORDER BY m.created_at DESC LIMIT ?";
  params.push(limit);

  const rows = await query(sql, params) as any[];

  // 返回时反转顺序（最早的在前）
  return { data: (rows as Message[]).reverse(), total };
}

// === 获取未读消息总数 ===
export async function getUnreadMessageCount(userId: number): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) as count FROM messages m
     INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id AND cp.user_id = ? AND cp.is_hidden = 0
     WHERE m.sender_id != ? AND m.is_read = 0`,
    [userId, userId]
  ) as any[];

  return result[0]?.count || 0;
}

// === 隐藏对话（软删除） ===
export async function hideConversation(
  userId: number,
  conversationId: number
): Promise<void> {
  const participant = await query(
    "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  ) as any[];

  if (participant.length === 0) {
    throw new Error("你不是该对话的参与者");
  }

  await query(
    "UPDATE conversation_participants SET is_hidden = 1 WHERE conversation_id = ? AND user_id = ?",
    [conversationId, userId]
  );
}

// === 订阅用户的私信频道（用于 SSE） ===
export async function subscribeToUserMessages(
  userId: number,
  callback: (data: any) => void
): Promise<() => void> {
  const channel = PM_CHANNEL_PREFIX + userId;
  
  // 创建独立的订阅连接（ioredis subscribe需要专用连接）
  const subRedis = new Redis({
    host: "124.225.88.94",
    port: 6379,
    password: "1234567",
    db: 3,
  });

  await subRedis.subscribe(channel);
  subRedis.on("message", (_ch: string, message: string) => {
    try {
      const data = JSON.parse(message);
      callback(data);
    } catch (err) {
      console.error("[PM] Redis message parse error:", err);
    }
  });

  // 返回取消订阅函数
  return () => {
    subRedis.unsubscribe(channel);
    subRedis.disconnect();
  };
}

// === 检查用户是否可以发送私信（频率限制） ===
export async function canSendMessage(userId: number): Promise<boolean> {
  const key = `pm_rate:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60); // 每分钟重置
    }
    return count <= 30; // 每分钟最多30条私信
  } catch {
    return true; // Redis不可用时允许发送
  }
}