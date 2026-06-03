import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import redis from "@/lib/redis";
import { getMinioClient, BUCKET_NAME } from "@/lib/minio";

type CheckStatus = "ok" | "error" | "warning";

interface HealthCheckResult {
  status: CheckStatus;
  latency?: number;
  error?: string;
  detail?: string;
}

/**
 * GET /api/health - 健康检查端点
 *
 * 用于负载均衡器、K8s 探针、监控服务、管理后台等检测应用是否健康
 * 检查项：数据库、Redis、MinIO
 *
 * 返回：
 * - 200: 所有检查通过
 * - 503: 任一检查失败
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, HealthCheckResult> = {};

  // === 数据库连接检查 ===
  try {
    const dbStart = Date.now();
    await sql`SELECT 1 AS health_check`.execute(db);
    checks.database = {
      status: "ok",
      latency: Date.now() - dbStart,
    };
  } catch (error: any) {
    checks.database = {
      status: "error",
      error: error.message || "数据库连接失败",
    };
  }

  // === Redis 连接检查 ===
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    checks.redis = {
      status: pong === "PONG" ? "ok" : "warning",
      latency: Date.now() - redisStart,
      detail: pong === "PONG" ? "连接正常" : `响应异常: ${pong}`,
    };
  } catch (error: any) {
    checks.redis = {
      status: "warning",
      error: error.message || "Redis 连接失败",
      detail: "Redis 不可用，已降级到内存存储",
    };
  }

  // === MinIO 存储检查 ===
  try {
    const minioStart = Date.now();
    const minioClient = getMinioClient();
    await minioClient.bucketExists(BUCKET_NAME);
    checks.minio = {
      status: "ok",
      latency: Date.now() - minioStart,
      detail: `存储桶 ${BUCKET_NAME} 可用`,
    };
  } catch (error: any) {
    checks.minio = {
      status: "error",
      error: error.message || "MinIO 连接失败",
    };
  }

  // === 汇总结果 ===
  const hasError = Object.values(checks).some((c) => c.status === "error");
  const hasWarning = Object.values(checks).some((c) => c.status === "warning");
  const overallStatus = hasError ? "unhealthy" : hasWarning ? "degraded" : "healthy";
  const totalLatency = Date.now() - startTime;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    latency: totalLatency,
    checks,
    version: process.env.npm_package_version || "0.1.0",
    uptime: formatUptime(process.uptime()),
    uptimeSeconds: process.uptime(),
  };

  return NextResponse.json(response, {
    status: hasError ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}
