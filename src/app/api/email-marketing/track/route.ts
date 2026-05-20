import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/email-marketing/track - 邮件打开/点击跟踪
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = parseInt(searchParams.get("campaign") || "0");
    const userId = parseInt(searchParams.get("user") || "0");
    const action = searchParams.get("action"); // open | click

    if (!campaignId || !userId || !action) {
      // 返回1x1透明像素
      return new NextResponse(
        Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
        { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } }
      );
    }

    // 更新日志状态
    if (action === "open") {
      await query(
        `UPDATE email_campaign_logs SET status = 'opened', opened_at = NOW() WHERE campaign_id = ? AND user_id = ? AND status = 'sent'`,
        [campaignId, userId]
      );
      await query("UPDATE email_campaigns SET open_count = open_count + 1 WHERE id = ?", [campaignId]);
    } else if (action === "click") {
      await query(
        `UPDATE email_campaign_logs SET status = 'clicked', clicked_at = NOW() WHERE campaign_id = ? AND user_id = ?`,
        [campaignId, userId]
      );
      await query("UPDATE email_campaigns SET click_count = click_count + 1 WHERE id = ?", [campaignId]);
    }

    // 返回1x1透明像素
    return new NextResponse(
      Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } }
    );
  } catch {
    return new NextResponse(
      Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
      { headers: { "Content-Type": "image/gif" } }
    );
  }
}