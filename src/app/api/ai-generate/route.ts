import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { generateWallpaper, getUserGenerations, AI_STYLES, AiStyle } from "@/lib/ai-generate";

// AI生成配额配置
const AI_QUOTA = {
  free: { daily: 3, label: "免费用户" },   // 免费用户3次/天
  pro: { daily: 30, label: "Pro会员" },     // Pro会员30次/天
  enterprise: { daily: -1, label: "企业用户" }, // 企业用户无限
};

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

    // 获取今日已用次数
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const usedRows = (await query(
      "SELECT COUNT(*) as count FROM ai_generations WHERE user_id = ? AND created_at >= ? AND status IN ('completed', 'processing')",
      [userId, todayStart.toISOString().slice(0, 19).replace("T", " ")]
    )) as any[];
    const usedToday = usedRows[0]?.count || 0;

    // 获取用户等级确定配额
    const tierRows = (await query(
      "SELECT tier FROM api_keys WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [userId]
    )) as any[];
    const tier = tierRows[0]?.tier || "free";
    const quota = AI_QUOTA[tier as keyof typeof AI_QUOTA] || AI_QUOTA.free;

    return NextResponse.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      styles: AI_STYLES,
      quota: {
        usedToday,
        dailyLimit: quota.daily,
        remaining: quota.daily === -1 ? -1 : Math.max(0, quota.daily - usedToday),
        tier,
        label: quota.label,
      },
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

    // === 配额检查 ===
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const usedRows = (await query(
      "SELECT COUNT(*) as count FROM ai_generations WHERE user_id = ? AND created_at >= ? AND status IN ('completed', 'processing')",
      [userId, todayStart.toISOString().slice(0, 19).replace("T", " ")]
    )) as any[];
    const usedToday = usedRows[0]?.count || 0;

    const tierRows = (await query(
      "SELECT tier FROM api_keys WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [userId]
    )) as any[];
    const tier = tierRows[0]?.tier || "free";
    const quota = AI_QUOTA[tier as keyof typeof AI_QUOTA] || AI_QUOTA.free;

    if (quota.daily !== -1 && usedToday >= quota.daily) {
      return NextResponse.json(
        { error: `今日AI生成次数已达上限（${quota.daily}次/${quota.label}），升级会员可获取更多次数`, quota: { usedToday, dailyLimit: quota.daily, tier } },
        { status: 429 }
      );
    }

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

    // === 生成成功后自动进入审核队列 ===
    // 将AI生成的图片插入 images 表，status=pending 审核状态
    if (result.imageUrl) {
      try {
        const insertResult = await query(
          `INSERT INTO images (title, url, storage_key, width, height, category, tags, uploaded_by, status, source_type, media_type)
           VALUES (?, ?, ?, ?, ?, 'ai_generated', ?, ?, 'pending', 'ai_generated', 'image')`,
          [
            `AI生成: ${prompt.trim().slice(0, 50)}`,
            result.imageUrl,
            result.imageUrl.split("/").pop() || "",
            w,
            h,
            JSON.stringify([validStyle, "ai-generated"]),
            userId,
          ]
        );
        const imageId = (insertResult as any).insertId;

        // 更新 ai_generations 记录关联 image_id
        await query(
          "UPDATE ai_generations SET image_id = ? WHERE id = ?",
          [imageId, result.generationId]
        );

        return NextResponse.json(
          {
            data: {
              generationId: result.generationId,
              imageUrl: result.imageUrl,
              imageId,
              status: "pending_review",
              message: "AI壁纸生成成功，已提交审核",
            },
            quota: {
              usedToday: usedToday + 1,
              dailyLimit: quota.daily,
              remaining: quota.daily === -1 ? -1 : Math.max(0, quota.daily - usedToday - 1),
            },
          },
          { status: 201 }
        );
      } catch (insertError: any) {
        console.error("AI image insert to review queue error:", insertError);
        // 插入审核队列失败不影响主流程
      }
    }

    return NextResponse.json(
      {
        data: {
          generationId: result.generationId,
          imageUrl: result.imageUrl,
        },
        message: "AI壁纸生成成功",
        quota: {
          usedToday: usedToday + 1,
          dailyLimit: quota.daily,
          remaining: quota.daily === -1 ? -1 : Math.max(0, quota.daily - usedToday - 1),
        },
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