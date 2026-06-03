import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

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
        Buffer.from(
          "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
          "base64"
        ),
        { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } }
      );
    }

    // 更新日志状态
    if (action === "open") {
      await db
        .updateTable("email_campaign_logs")
        .set({ status: "opened", opened_at: sql`NOW()` })
        .where("campaign_id", "=", campaignId)
        .where("user_id", "=", userId)
        .where("status", "=", "sent")
        .executeTakeFirst();

      await sql`UPDATE email_campaigns SET open_count = open_count + 1 WHERE id = ${campaignId}`.execute(db);
    } else if (action === "click") {
      await db
        .updateTable("email_campaign_logs")
        .set({ status: "clicked", clicked_at: sql`NOW()` })
        .where("campaign_id", "=", campaignId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      await sql`UPDATE email_campaigns SET click_count = click_count + 1 WHERE id = ${campaignId}`.execute(db);
    }

    // 返回1x1透明像素
    return new NextResponse(
      Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
      ),
      { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } }
    );
  } catch {
    return new NextResponse(
      Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
      ),
      { headers: { "Content-Type": "image/gif" } }
    );
  }
}
