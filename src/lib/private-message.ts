/**
 * 私信系统核心库
 * 
 * 提供对话管理和消息发送/获取功能
 * 使用 Redis pub/sub 实现跨实例实时消息推送
 */

import { db } from "@/lib/db";
import { sql } from "kysely";
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
  // 不能和自己发起对话
  if (userId1 === userId2) {
    throw new Error("不能和自己发起对话");
  }

  // 查找是否已有对话
  const existing = await db
    .selectFrom("conversations as c")
    .innerJoin("conversation_participants as cp1", (join) =>
      join
        .onRef("c.id", "=", "cp1.conversation_id")
        .on("cp1.user_id", "=", userId1)
    )
    .innerJoin("conversation_participants as cp2", (join) =>
      join
        .onRef("c.id", "=", "cp2.conversation_id")
        .on("cp2.user_id", "=", userId2)
    )
    .where("cp1.is_hidden", "=", 0)
    .where("cp2.is_hidden", "=", 0)
    .select("c.id")
    .executeTakeFirst();

  if (existing) {
    return existing.id;
  }

  // 创建新对话（事务保证一致性）
  const conversationId = await db.transaction().execute(async (trx) => {
    const result = await trx
      .insertInto("conversations")
      .values({})
      .executeTakeFirst();
    const convId = Number(result.insertId);

    await trx
      .insertInto("conversation_participants")
      .values([
        { conversation_id: convId, user_id: userId1 },
        { conversation_id: convId, user_id: userId2 },
      ])
      .execute();

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
  const participants = await db
    .selectFrom("conversation_participants")
    .where("conversation_id", "=", conversationId)
    .select("user_id")
    .execute();

  const isParticipant = participants.some((p) => p.user_id === senderId);
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
  const result = await db.transaction().execute(async (trx) => {
    const msgResult = await trx
      .insertInto("messages")
      .values({
        conversation_id: conversationId,
        sender_id: senderId,
        content: cleanContent,
        message_type: messageType,
      })
      .executeTakeFirst();

    // 更新对话的 updated_at（触发 ON UPDATE）
    await trx
      .updateTable("conversations")
      .set({ updated_at: sql`NOW()` })
      .where("id", "=", conversationId)
      .execute();

    // 对其他参与者取消隐藏（如果之前隐藏了）
    await trx
      .updateTable("conversation_participants")
      .set({ is_hidden: 0 })
      .where("conversation_id", "=", conversationId)
      .where("user_id", "!=", senderId)
      .where("is_hidden", "=", 1)
      .execute();

    const msgId = Number(msgResult.insertId);

    // 获取完整消息
    const row = await trx
      .selectFrom("messages as m")
      .innerJoin("users as u", "m.sender_id", "u.id")
      .where("m.id", "=", msgId)
      .select((eb) => [
        sql<Message>`m.*`.as("msg"),
        eb.ref("u.name").as("sender_name"),
        eb.ref("u.avatar").as("sender_avatar"),
      ])
      .executeTakeFirst();

    return row as unknown as Message;
  });

  // 通过 Redis pub/sub 推送消息给其他参与者
  const otherUserIds = participants
    .filter((p) => p.user_id !== senderId)
    .map((p) => p.user_id);

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

  return result;
}

// === 获取对话列表 ===
export async function getConversations(
  userId: number,
  page: number = 1,
  limit: number = 20
): Promise<{ data: Conversation[]; total: number }> {
  const offset = (page - 1) * limit;

  // 获取用户参与的对话（未隐藏的）
  const totalRow = await db
    .selectFrom("conversation_participants")
    .where("user_id", "=", userId)
    .where("is_hidden", "=", 0)
    .select((eb) => eb.fn.countAll().as("total"))
    .executeTakeFirst();
  const total = Number(totalRow?.total ?? 0);

  const rows = await db
    .selectFrom("conversations as c")
    .innerJoin("conversation_participants as my_p", (join) =>
      join
        .onRef("c.id", "=", "my_p.conversation_id")
        .on("my_p.user_id", "=", userId)
        .on("my_p.is_hidden", "=", 0)
    )
    .innerJoin("conversation_participants as other_p", (join) =>
      join
        .onRef("c.id", "=", "other_p.conversation_id")
        .on("other_p.user_id", "!=", userId)
    )
    .innerJoin("users as other_u", "other_p.user_id", "other_u.id")
    .leftJoin("messages as last_msg", (join) =>
      join
        .onRef("c.id", "=", "last_msg.conversation_id")
        .on(
          "last_msg.id",
          "=",
          (eb) =>
            eb
              .selectFrom("messages")
              .select((eb2) => eb2.fn.max("id").as("max_id"))
              .whereRef("conversation_id", "=", "c.id")
        )
    )
    .select((eb) => [
      eb.ref("c.id").as("id"),
      eb.ref("c.created_at").as("created_at"),
      eb.ref("c.updated_at").as("updated_at"),
      eb.ref("other_p.user_id").as("other_user_id"),
      eb.ref("other_u.name").as("other_user_name"),
      eb.ref("other_u.avatar").as("other_user_avatar"),
      eb.ref("last_msg.content").as("last_message_content"),
      eb.ref("last_msg.sender_id").as("last_message_sender_id"),
      eb.ref("last_msg.created_at").as("last_message_created_at"),
      eb
        .selectFrom("messages")
        .select((eb2) => eb2.fn.countAll().as("cnt"))
        .where("is_read", "=", 0)
        .where("sender_id", "!=", userId)
        .whereRef("conversation_id", "=", "c.id")
        .as("unread_count"),
    ])
    .orderBy("c.updated_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  // Map results: merge conversation columns with joined columns
  const data = rows.map((row: any) => ({
    id: row.id ?? row.conversation?.id,
    created_at: row.created_at ?? row.conversation?.created_at,
    updated_at: row.updated_at ?? row.conversation?.updated_at,
    other_user_id: row.other_user_id,
    other_user_name: row.other_user_name,
    other_user_avatar: row.other_user_avatar,
    last_message_content: row.last_message_content,
    last_message_sender_id: row.last_message_sender_id,
    last_message_created_at: row.last_message_created_at,
    unread_count: Number(row.unread_count ?? 0),
  })) as Conversation[];

  return { data, total };
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
  const participant = await db
    .selectFrom("conversation_participants")
    .where("conversation_id", "=", conversationId)
    .where("user_id", "=", userId)
    .select("user_id")
    .execute();

  if (participant.length === 0) {
    throw new Error("你不是该对话的参与者");
  }

  // 标记所有对方消息为已读
  await db
    .updateTable("messages")
    .set({ is_read: 1 })
    .where("conversation_id", "=", conversationId)
    .where("sender_id", "!=", userId)
    .where("is_read", "=", 0)
    .execute();

  // 更新用户的最后已读时间
  await db
    .updateTable("conversation_participants")
    .set({ last_read_at: sql`NOW()` })
    .where("conversation_id", "=", conversationId)
    .where("user_id", "=", userId)
    .execute();

  // 获取消息总数
  const totalRow = await db
    .selectFrom("messages")
    .where("conversation_id", "=", conversationId)
    .select((eb) => eb.fn.countAll().as("total"))
    .executeTakeFirst();
  const total = Number(totalRow?.total ?? 0);

  // 获取消息（支持游标加载，beforeId用于向上翻页）
  let query = db
    .selectFrom("messages as m")
    .innerJoin("users as u", "m.sender_id", "u.id")
    .where("m.conversation_id", "=", conversationId);

  if (beforeId) {
    query = query.where("m.id", "<", beforeId);
  }

  const rows = await query
    .select((eb) => [
      eb.ref("m.id").as("id"),
      eb.ref("m.conversation_id").as("conversation_id"),
      eb.ref("m.sender_id").as("sender_id"),
      eb.ref("m.content").as("content"),
      eb.ref("m.is_read").as("is_read"),
      eb.ref("m.message_type").as("message_type"),
      eb.ref("m.created_at").as("created_at"),
      eb.ref("u.name").as("sender_name"),
      eb.ref("u.avatar").as("sender_avatar"),
    ])
    .orderBy("m.created_at", "desc")
    .limit(limit)
    .execute();

  // 返回时反转顺序（最早的在前）
  return { data: (rows as unknown as Message[]).reverse(), total };
}

// === 获取未读消息总数 ===
export async function getUnreadMessageCount(userId: number): Promise<number> {
  const row = await db
    .selectFrom("messages as m")
    .innerJoin("conversation_participants as cp", (join) =>
      join
        .onRef("m.conversation_id", "=", "cp.conversation_id")
        .on("cp.user_id", "=", userId)
        .on("cp.is_hidden", "=", 0)
    )
    .where("m.sender_id", "!=", userId)
    .where("m.is_read", "=", 0)
    .select((eb) => eb.fn.countAll().as("count"))
    .executeTakeFirst();

  return Number(row?.count ?? 0);
}

// === 隐藏对话（软删除） ===
export async function hideConversation(
  userId: number,
  conversationId: number
): Promise<void> {
  const participant = await db
    .selectFrom("conversation_participants")
    .where("conversation_id", "=", conversationId)
    .where("user_id", "=", userId)
    .select("user_id")
    .execute();

  if (participant.length === 0) {
    throw new Error("你不是该对话的参与者");
  }

  await db
    .updateTable("conversation_participants")
    .set({ is_hidden: 1 })
    .where("conversation_id", "=", conversationId)
    .where("user_id", "=", userId)
    .execute();
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
