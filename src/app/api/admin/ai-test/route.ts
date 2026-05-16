import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiConfig } from "@/lib/ai-generate";

// POST /api/admin/ai-test - 测试AI服务连通性
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    // 允许临时传入配置测试（不保存到数据库）
    const testProvider = body.provider;
    const testApiKey = body.apiKey;
    const testBaseUrl = body.baseUrl;
    const testModel = body.model;

    // 如果传了临时配置就用临时配置，否则用数据库配置
    let provider: string;
    let apiKey: string;
    let baseUrl: string;
    let model: string;

    if (testApiKey) {
      provider = testProvider || "openai";
      apiKey = testApiKey;
      baseUrl = testBaseUrl || "https://api.openai.com/v1";
      model = testModel || "dall-e-3";
    } else {
      const config = await getAiConfig();
      provider = config.provider;
      apiKey = config.apiKey;
      baseUrl = config.baseUrl;
      model = config.model;
    }

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "未配置 API 密钥" },
        { status: 400 }
      );
    }

    const baseEndpoint = baseUrl.replace(/\/+$/, "");

    if (provider === "stability") {
      // Stability AI: 测试 /v1/engines/list 接口
      const res = await fetch(`${baseEndpoint}/engines/list`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          success: true,
          message: `Stability AI 连接成功`,
          models: (data || []).map((e: any) => e.id).slice(0, 10),
          latency: res.headers.get("x-response-time") || undefined,
        });
      } else {
        const error = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          error: `连接失败 (${res.status}): ${error.message || res.statusText}`,
        });
      }
    } else {
      // OpenAI / 兼容 API: 测试 /models 接口
      const res = await fetch(`${baseEndpoint}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const modelList = (data.data || []).map((m: any) => m.id);
        const hasModel = modelList.some((id: string) => id.includes(model) || id === model);

        return NextResponse.json({
          success: true,
          message: `API 连接成功`,
          modelsAvailable: modelList.length,
          hasTargetModel: hasModel,
          modelList: modelList.slice(0, 20),
        });
      } else {
        const error = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          error: `连接失败 (${res.status}): ${error.error?.message || res.statusText}`,
        });
      }
    }
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
      return NextResponse.json({
        success: false,
        error: "连接超时 (10秒)，请检查地址是否正确",
      });
    }
    console.error("AI连通性测试失败:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "测试失败",
    }, { status: 500 });
  }
}