import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/images/[id]/paid-status - 检查壁纸付费状态
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查是否为付费壁纸
    const paidRows = (await query(
      "SELECT price, user_id FROM paid_wallpapers WHERE image_id = ? AND is_paid = 1",
      [id]
    )) as any[];

    if (paidRows.length === 0) {
      return NextResponse.json({ is_paid_wallpaper: false });
    }

    const price = parseFloat(paidRows[0].price);
    const creatorId = paidRows[0].user_id;

    // 检查当前用户是否已购买
    let hasPurchased = false;
    const session = await auth();
    const userId = (session?.user as any)?.id;

    if (userId) {
      // 作者本人视为已拥有
      if (userId === creatorId) {
        hasPurchased = true;
      } else {
        const orderRows = (await query(
          "SELECT id FROM orders WHERE user_id = ? AND type = 'paid_wallpaper' AND related_id = ? AND payment_status = 'paid'",
          [userId, id]
        )) as any[];
        hasPurchased = orderRows.length > 0;
      }
    }

    // 获取图片标题
    const imageRows = (await query(
      "SELECT title FROM images WHERE id = ?",
      [id]
    )) as any[];

    return NextResponse.json({
      is_paid_wallpaper: true,
      price,
      has_purchased: hasPurchased,
      creator_id: creatorId,
      image_title: imageRows[0]?.title || "",
    });
  } catch (error: any) {
    console.error("GET /api/images/[id]/paid-status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}