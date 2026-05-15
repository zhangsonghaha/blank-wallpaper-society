import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateWallpaper, getUserGenerations, AI_STYLES, AiStyle } from "@/lib/ai-generate";

// GET /api/ai-generate - 获取用户的AI生成历史
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await getUserGenerations(userId, limit, (page - 1) * limit);

    return NextResponse.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      styles: AI_STYLES,
    });
  } catch (error: any) {
    console.error("GET /api/ai-generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/ai-generate - 生成AI壁纸
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { prompt, style, width, height, model } = body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "请输入描述文字" }, { status: 400 });
    }

    if (prompt.trim().length > 500) {
      return NextResponse.json({ error: "描述文字不能超过500字" }, { status: 400 });
    }

    // 验证风格
    const validStyle = AI_STYLES[style as AiStyle] ? style : "realistic";

    // 验证尺寸范围
    const w = Math.min(Math.max(parseInt(width) || 1920, 512), 2048);
    const h = Math.min(Math.max(parseInt(height) || 1080, 512), 2048);

    // 构建增强prompt
    const styleConfig = AI_STYLES[validStyle as AiStyle];
    const enhancedPrompt = `${prompt.trim()}, ${styleConfig.prompt}, wallpaper, desktop background`;

    const result = await generateWallpaper({
      userId,
      prompt: enhancedPrompt,
      style: validStyle as AiStyle,
      width: w,
      height: h,
      model: model || "dall-e",
    });

    return NextResponse.json(
      {
        data: {
          generationId: result.generationId,
          imageUrl: result.imageUrl,
        },
        message: "AI壁纸生成成功",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/ai-generate error:", error);
    return NextResponse.json(
      { error: error.message || "AI生成失败" },
      { status: 500 }
    );
  }
}