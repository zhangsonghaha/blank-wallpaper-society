import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getEarningsOverview,
  requestWithdrawal,
  setPaidWallpaper,
  createTip,
  subscribeMembership,
  TIP_AMOUNTS,
  MEMBERSHIP_PRICES,
  PAID_WALLPAPER_PRICE_RANGE,
} from "@/lib/earnings";

// GET /api/earnings - 获取创作者收益概览
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const overview = await getEarningsOverview(userId);

    return NextResponse.json({
      data: overview,
      config: {
        tipAmounts: TIP_AMOUNTS,
        membershipPrices: MEMBERSHIP_PRICES,
        paidWallpaperPriceRange: PAID_WALLPAPER_PRICE_RANGE,
      },
    });
  } catch (error: any) {
    console.error("GET /api/earnings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/earnings - 操作（打赏/付费壁纸设置/会员订阅/提现）
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "set_paid_wallpaper": {
        const { imageId, price } = body;
        if (!imageId || !price) {
          return NextResponse.json({ error: "缺少参数" }, { status: 400 });
        }
        const result = await setPaidWallpaper(imageId, userId, parseFloat(price));
        return NextResponse.json({ data: result, message: "付费壁纸设置成功" });
      }

      case "tip": {
        const { toUserId, amount, imageId, message } = body;
        if (!toUserId || !amount) {
          return NextResponse.json({ error: "缺少参数" }, { status: 400 });
        }
        const result = await createTip(userId, toUserId, parseFloat(amount), imageId, message);
        return NextResponse.json({ data: result, message: "打赏成功" }, { status: 201 });
      }

      case "subscribe": {
        const { plan } = body;
        if (!plan || !MEMBERSHIP_PRICES[plan as keyof typeof MEMBERSHIP_PRICES]) {
          return NextResponse.json({ error: "无效的套餐" }, { status: 400 });
        }
        const result = await subscribeMembership(userId, plan);
        return NextResponse.json({ data: result, message: "订阅成功" }, { status: 201 });
      }

      case "withdraw": {
        const { amount } = body;
        if (!amount) {
          return NextResponse.json({ error: "请输入提现金额" }, { status: 400 });
        }
        const result = await requestWithdrawal(userId, parseFloat(amount));
        return NextResponse.json({ data: result });
      }

      default:
        return NextResponse.json({ error: "无效的操作" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("POST /api/earnings error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}