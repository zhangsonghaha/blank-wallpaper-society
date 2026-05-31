/**
 * 消息 API
 * 
 * GET  /api/messages?conversationId=1 — 获取对话中的消息
 * POST /api/messages — 发送消息
 * GET  /api/messages/unread — 获取未读消息数
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendMessage, getMessages, getUnreadMessageCount, canSendMessage } from "@/lib/private-message";
import { pushNotification } from "@/lib/notification";
import { query } from "@/lib/db";

// GET /api/messages — 获取消息 / 未读数
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id as string);
    const { searchParams } = new URL(request.url);

    // 获取未读消息数
    if (searchParams.get("action") === "unread") {
      const count = await getUnreadMessageCount(userId);
      return NextResponse.json({ unreadCount: count });
    }

    // 获取对话中的消息
    const conversationId = parseInt(searchParams.get("conversationId") || "0");
    if (!conversationId) {
      return NextResponse.json({ error: "请指定对话ID" }, { status: 400 });
    }

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const beforeId = searchParams.get("beforeId")
      ? parseInt(searchParams.get("beforeId")!)
      : undefined;

    const result = await getMessages(userId, conversationId, page, limit, beforeId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/messages error:", error);
    if (error.message === "你不是该对话的参与者") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/messages — 发送消息
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id as string);
    const body = await request.json();
    const { conversationId, content, messageType } = body;

    if (!conversationId || !content) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    if (!content.trim()) {
      return NextResponse.json({ error: "消息内容不能为空" }, { status: 400 });
    }

    // 频率限制
    const canSend = await canSendMessage(userId);
    if (!canSend) {
      return NextResponse.json({ error: "发送频率过高，请稍后再试" }, { status: 429 });
    }

    const message = await sendMessage(
      userId,
      parseInt(conversationId),
      content,
      messageType || "text"
    );

    // 向接收者推送通知
    try {
      // 获取对话中的另一个用户
      const participants = await query(
        "SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?",
        [parseInt(conversationId), userId]
      ) as any[];

      if (participants.length > 0) {
        const receiverId = participants[0].user_id;
        const senderName = (session.user as any).name || "用户";
        await pushNotification({
          userId: receiverId,
          type: "message",
          title: `📩 新私信：${senderName}`,
          content: content.length > 50 ? content.substring(0, 50) + "..." : content,
          relatedId: parseInt(conversationId),
          relatedType: "user",
        });
      }
    } catch (err) {
      console.error("[PM] 通知推送失败:", err);
      // 通知失败不影响消息发送
    }

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error("POST /api/messages error:", error);
    if (error.message === "你不是该对话的参与者") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message === "消息内容不能超过2000字") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}