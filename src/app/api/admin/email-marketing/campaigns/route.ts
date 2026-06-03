import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { getCampaigns, createCampaign, updateCampaign, sendCampaign, generateWeeklyDigestHtml } from "@/lib/email-marketing";

// GET /api/admin/email-marketing/campaigns - 获取营销活动列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await getCampaigns(page, limit);

    // 获取订阅统计
    const subStatsRows = await db
      .selectFrom("email_subscriptions")
      .select((eb) => [
        eb.fn.countAll().as("total"),
        sql<number>`SUM(weekly_digest)`.as("weekly_subscribers"),
        sql<number>`SUM(activity_notice)`.as("activity_subscribers"),
        sql<number>`SUM(creator_update)`.as("creator_subscribers"),
        sql<number>`SUM(is_unsubscribed)`.as("unsubscribed"),
      ])
      .execute();
    const subStats = subStatsRows[0];

    return NextResponse.json({
      data: result.data,
      total: result.total,
      subscriptionStats: {
        total: Number(subStats?.total ?? 0),
        weeklySubscribers: Number(subStats?.weekly_subscribers ?? 0),
        activitySubscribers: Number(subStats?.activity_subscribers ?? 0),
        creatorSubscribers: Number(subStats?.creator_subscribers ?? 0),
        unsubscribed: Number(subStats?.unsubscribed ?? 0),
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/email-marketing/campaigns error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// POST /api/admin/email-marketing/campaigns - 创建/发送营销活动
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }
    const userId = (session.user as any).id;

    const body = await request.json();
    const { action } = body;

    // 生成每周精选
    if (action === "generate_weekly") {
      const digest = await generateWeeklyDigestHtml();
      const campaignId = await createCampaign({
        subject: digest.subject,
        bodyHtml: digest.html,
        bodyText: digest.text,
        campaignType: "weekly_digest",
        createdBy: userId,
      });
      return NextResponse.json({ message: "每周精选已生成", campaignId });
    }

    // 创建活动
    if (action === "create") {
      const { subject, bodyHtml, bodyText, campaignType, scheduledAt } = body;
      if (!subject || !bodyHtml) {
        return NextResponse.json({ error: "主题和内容不能为空" }, { status: 400 });
      }
      const campaignId = await createCampaign({
        subject,
        bodyHtml,
        bodyText,
        campaignType: campaignType || "system",
        scheduledAt,
        createdBy: userId,
      });
      return NextResponse.json({ message: "活动已创建", campaignId });
    }

    // 发送活动
    if (action === "send") {
      const { campaignId } = body;
      if (!campaignId) {
        return NextResponse.json({ error: "缺少活动ID" }, { status: 400 });
      }
      const result = await sendCampaign(campaignId);
      return NextResponse.json({ message: "活动已发送", ...result });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/email-marketing/campaigns error:", error);
    return NextResponse.json({ error: error.message || "操作失败" }, { status: 500 });
  }
}

// PATCH /api/admin/email-marketing/campaigns - 更新营销活动
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const body = await request.json();
    const { id, subject, bodyHtml, bodyText, scheduledAt, status } = body;
    if (!id) {
      return NextResponse.json({ error: "缺少活动ID" }, { status: 400 });
    }

    await updateCampaign(id, { subject, bodyHtml, bodyText, scheduledAt, status });
    return NextResponse.json({ message: "活动已更新" });
  } catch (error: any) {
    console.error("PATCH /api/admin/email-marketing/campaigns error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}