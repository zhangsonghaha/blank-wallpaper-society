import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSubscription, updateSubscription, ensureSubscription } from "@/lib/email-marketing";

// GET /api/user/email-preferences - 获取用户邮件订阅偏好
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;
    const email = (session.user as any).email;
    if (!email) {
      return NextResponse.json({ error: "用户无邮箱" }, { status: 400 });
    }

    // 确保有订阅记录
    await ensureSubscription(userId, email);
    const sub = await getSubscription(userId);

    return NextResponse.json({
      weekly_digest: !!sub?.weekly_digest,
      activity_notice: !!sub?.activity_notice,
      creator_update: !!sub?.creator_update,
      is_unsubscribed: !!sub?.is_unsubscribed,
      unsub_token: sub?.unsub_token || null,
    });
  } catch (error: any) {
    console.error("GET /api/user/email-preferences error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// PATCH /api/user/email-preferences - 更新用户邮件订阅偏好
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const body = await request.json();
    const { weekly_digest, activity_notice, creator_update } = body;

    // 如果用户重新订阅任何类型，清除全局退订状态
    const anySubscribe = (weekly_digest || activity_notice || creator_update);
    await updateSubscription(userId, {
      weekly_digest: weekly_digest !== undefined ? Boolean(weekly_digest) : undefined,
      activity_notice: activity_notice !== undefined ? Boolean(activity_notice) : undefined,
      creator_update: creator_update !== undefined ? Boolean(creator_update) : undefined,
      ...(anySubscribe ? { is_unsubscribed: false } : {}),
    });

    return NextResponse.json({ message: "偏好已更新" });
  } catch (error: any) {
    console.error("PATCH /api/user/email-preferences error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}