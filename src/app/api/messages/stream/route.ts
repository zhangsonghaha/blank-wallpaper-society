/**
 * 私信 SSE 实时推送端点
 * 
 * GET /api/messages/stream — 建立SSE连接，接收实时私信推送
 * 使用 Redis pub/sub 订阅用户专属频道，新消息到达时推送事件
 */

import { auth } from "@/lib/auth";
import { subscribeToUserMessages } from "@/lib/private-message";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("未登录", { status: 401 });
  }

  const userId = parseInt((session.user as any).id as string);

  // 创建 SSE 流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始连接确认
      const connectEvent = `event: connected\ndata: {"userId":${userId},"timestamp":"${Date.now()}"}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // 定时发送心跳，防止连接超时
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 订阅 Redis 消息频道
      const unsubscribe = await subscribeToUserMessages(userId, (data) => {
        try {
          const event = `event: message\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(event));
        } catch {
          unsubscribe();
          clearInterval(heartbeat);
        }
      });

      // 监听客户端断开（通过 AbortSignal）
      // Note: Next.js API routes 不直接支持 AbortSignal，
      // 但当客户端关闭连接时，stream 会自动关闭
      // 我们需要确保清理
      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch {}
      };

      // 30分钟超时自动关闭
      setTimeout(cleanup, 30 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Nginx不缓冲
    },
  });
}