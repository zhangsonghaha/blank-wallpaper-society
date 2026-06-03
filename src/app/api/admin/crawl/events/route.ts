import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/crawl/events - SSE 实时推送爬虫任务进度
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "admin") {
    return new Response("Unauthorized", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始连接消息
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`)
      );

      // 轮询爬虫任务状态
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          // 获取正在运行的任务
          const runningTasks = await db
            .selectFrom("crawl_logs")
            .select([
              "id", "source", "crawl_mode", "status", "requested_count",
              "success_count", "fail_count", "started_at", "duration_seconds",
            ])
            .where("status", "in", ["running", "pending"])
            .orderBy("started_at", "desc")
            .limit(5)
            .execute();

          // 获取最近完成的任务
          const recentCompleted = await db
            .selectFrom("crawl_logs")
            .select([
              "id", "source", "crawl_mode", "status", "requested_count",
              "success_count", "fail_count", "dedup_skipped", "duration_seconds", "finished_at",
            ])
            .where("status", "in", ["completed", "failed"])
            .orderBy("finished_at", "desc")
            .limit(5)
            .execute();

          const event = {
            type: "status_update",
            timestamp: Date.now(),
            runningTasks,
            recentCompleted,
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch (error) {
          console.error("SSE polling error:", error);
        }
      }, 3000); // 每3秒推送一次

      // 监听客户端断开
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
