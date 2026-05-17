/**
 * Next.js Instrumentation Hook
 * 在服务启动和关闭时执行清理逻辑
 * 
 * Next.js 在 Node.js runtime 中调用 register()，适合处理：
 * - 数据库连接池关闭
 * - Redis 连接关闭
 * - 信号处理
 */
export async function register() {
  // 仅在 Node.js runtime（服务端）执行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const logger = (msg: string) => {
      console.log(JSON.stringify({
        type: "lifecycle",
        message: msg,
        timestamp: new Date().toISOString(),
      }));
    };

    let isShuttingDown = false;

    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger(`收到 ${signal} 信号，开始优雅关闭...`);

      // 1. 关闭 Redis 连接
      try {
        const redis = (await import("@/lib/redis")).default;
        if (redis.status === "ready" || redis.status === "connect") {
          redis.disconnect();
          logger("Redis 连接已关闭");
        }
      } catch (err) {
        logger(`Redis 关闭异常（可忽略）: ${(err as Error).message}`);
      }

      // 2. 关闭数据库连接池
      try {
        const pool = (await import("@/lib/db")).default;
        await pool.end();
        logger("数据库连接池已关闭");
      } catch (err) {
        logger(`数据库连接池关闭异常（可忽略）: ${(err as Error).message}`);
      }

      logger("优雅关闭完成，进程退出");
      process.exit(0);
    };

    // 注册信号处理
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    logger("优雅关闭处理器已注册（SIGTERM/SIGINT）");
  }
}