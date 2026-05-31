/**
 * 对话管理 API
 * 
 * GET  /api/messages/conversations — 获取对话列表
 * POST /api/messages/conversations — 创建/获取对话
 * DELETE /api/messages/conversations — 隐藏对话
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getConversations,
  createOrGetConversation,
  hideConversation,
} from "@/lib/private-message";

// GET /api/messages/conversations — 获取对话列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id as string);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await getConversations(userId, page, limit);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/messages/conversations error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/messages/conversations — 创建/获取对话
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id as string);
    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: "请指定对话目标用户" }, { status: 400 });
    }

    const targetId = parseInt(targetUserId);
    if (isNaN(targetId)) {
      return NextResponse.json({ error: "无效的目标用户ID" }, { status: 400 });
    }

    const conversationId = await createOrGetConversation(userId, targetId);

    return NextResponse.json({ conversationId });
  } catch (error: any) {
    console.error("POST /api/messages/conversations error:", error);
    if (error.message === "不能和自己发起对话") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/messages/conversations — 隐藏对话
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id as string);
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: "请指定对话ID" }, { status: 400 });
    }

    await hideConversation(userId, parseInt(conversationId));

    return NextResponse.json({ message: "对话已隐藏" });
  } catch (error: any) {
    console.error("DELETE /api/messages/conversations error:", error);
    if (error.message === "你不是该对话的参与者") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}