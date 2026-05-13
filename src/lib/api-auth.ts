import { NextRequest, NextResponse } from "next/server";
import {
  findApiKeyByKey,
  checkApiKeyRateLimit,
  checkIpRateLimit,
  logApiUsage,
  updateKeyLastUsed,
  buildRateLimitHeaders,
} from "@/lib/rate-limit";

interface AuthResult {
  authenticated: boolean;
  apiKeyInfo?: {
    id: number;
    user_id: number;
    rate_limit: number;
  };
  rateLimitHeaders: Record<string, string>;
  error?: NextResponse;
  ipAddress: string;
}

/**
 * 统一API认证+限流处理
 * 支持两种方式：
 * 1. API Key（通过Header: X-API-Key 或 Query: api_key）
 * 2. 匿名IP限流（每日100次）
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<AuthResult> {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "0.0.0.0";

  // 尝试获取API Key
  const apiKey =
    request.headers.get("x-api-key") ||
    request.nextUrl.searchParams.get("api_key");

  if (apiKey) {
    // API Key认证
    const keyInfo = await findApiKeyByKey(apiKey);

    if (!keyInfo) {
      return {
        authenticated: false,
        rateLimitHeaders: {},
        error: NextResponse.json(
          { success: false, error: { code: "INVALID_API_KEY", message: "无效的API Key" } },
          { status: 401 }
        ),
        ipAddress,
      };
    }

    if (!keyInfo.is_active) {
      return {
        authenticated: false,
        rateLimitHeaders: {},
        error: NextResponse.json(
          { success: false, error: { code: "API_KEY_DISABLED", message: "API Key已被禁用" } },
          { status: 403 }
        ),
        ipAddress,
      };
    }

    // 限流检查
    const rateResult = await checkApiKeyRateLimit(keyInfo.id, keyInfo.rate_limit);
    const rateLimitHeaders = buildRateLimitHeaders(
      rateResult.limit,
      rateResult.remaining,
      rateResult.reset
    );

    if (!rateResult.allowed) {
      return {
        authenticated: false,
        rateLimitHeaders,
        error: NextResponse.json(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "已超出每日请求限制",
              limit: rateResult.limit,
              reset: rateResult.reset,
            },
          },
          { status: 429, headers: rateLimitHeaders }
        ),
        ipAddress,
      };
    }

    // 更新最后使用时间（异步不阻塞）
    updateKeyLastUsed(keyInfo.id).catch(() => {});

    return {
      authenticated: true,
      apiKeyInfo: {
        id: keyInfo.id,
        user_id: keyInfo.user_id,
        rate_limit: keyInfo.rate_limit,
      },
      rateLimitHeaders,
      ipAddress,
    };
  }

  // 匿名IP限流
  const ipRateResult = checkIpRateLimit(ipAddress);
  const rateLimitHeaders = buildRateLimitHeaders(
    ipRateResult.limit,
    ipRateResult.remaining,
    ipRateResult.reset
  );

  if (!ipRateResult.allowed) {
    return {
      authenticated: false,
      rateLimitHeaders,
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "匿名请求已超出每日限制（100次），请使用API Key获取更高配额",
            limit: ipRateResult.limit,
            reset: ipRateResult.reset,
          },
        },
        { status: 429, headers: rateLimitHeaders }
      ),
      ipAddress,
    };
  }

  return {
    authenticated: true,
    rateLimitHeaders,
    ipAddress,
  };
}

/**
 * 记录API使用日志（异步，不阻塞响应）
 */
export function recordUsage(
  apiKeyId: number | undefined,
  endpoint: string,
  ipAddress: string,
  statusCode: number
) {
  if (apiKeyId) {
    logApiUsage(apiKeyId, endpoint, ipAddress, statusCode).catch(() => {});
  }
}