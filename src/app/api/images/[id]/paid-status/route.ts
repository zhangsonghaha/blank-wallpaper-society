import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/images/[id]/paid-status - 检查壁纸付费状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = Number(id);

    // 检查是否为付费壁纸
    const paidRow = await db
      .selectFrom("paid_wallpapers")
      .where("image_id", "=", imageId)
      .where("is_paid", "=", 1)
      .select(["price", "user_id"])
      .executeTakeFirst();

    if (!paidRow) {
      return NextResponse.json({ is_paid_wallpaper: false });
    }

    const price = parseFloat(String(paidRow.price));
    const creatorId = paidRow.user_id;

    // 检查当前用户是否已购买
    let hasPurchased = false;
    const session = await auth();
    const userId = (session?.user as any)?.id;

    if (userId) {
      // 作者本人视为已拥有
      if (userId === creatorId) {
        hasPurchased = true;
      } else {
        const orderRow = await db
          .selectFrom("orders")
          .where("user_id", "=", userId)
          .where("type", "=", "paid_wallpaper")
          .where("related_id", "=", imageId)
          .where("payment_status", "=", "paid")
          .select("id")
          .executeTakeFirst();
        hasPurchased = !!orderRow;
      }
    }

    // 获取图片标题
    const imageRow = await db
      .selectFrom("images")
      .where("id", "=", imageId)
      .select("title")
      .executeTakeFirst();

    return NextResponse.json({
      is_paid_wallpaper: true,
      price,
      has_purchased: hasPurchased,
      creator_id: creatorId,
      image_title: imageRow?.title || "",
    });
  } catch (error: any) {
    console.error("GET /api/images/[id]/paid-status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
