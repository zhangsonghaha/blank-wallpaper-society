import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  requestAccountDeletion,
  cancelAccountDeletion,
  getAccountDeletionStatus,
} from "@/lib/account-deletion";
import crypto from "crypto";

/**
 * POST /api/auth/account-deletion - 请求注销账号
 * 需要密码验证
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }

    // 验证密码
    const users = (await query(
      "SELECT password FROM users WHERE id = ?",
      [userId]
    )) as any[];

    if (users.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const hash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    if (hash !== users[0].password) {
      return NextResponse.json({ error: "密码不正确" }, { status: 400 });
    }

    // 请求注销
    const result = await requestAccountDeletion(userId);

    return NextResponse.json({
      message: "注销申请已提交，账号将在7天后注销。在此期间您可以随时取消。",
      scheduledAt: result.scheduledAt.toISOString(),
    });
  } catch (error: any) {
    console.error("请求注销失败:", error);
    return NextResponse.json(
      { error: error.message || "请求注销失败" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/auth/account-deletion - 取消注销请求
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);

    await cancelAccountDeletion(userId);

    return NextResponse.json({
      message: "注销申请已取消，您的账号已恢复正常。",
    });
  } catch (error: any) {
    console.error("取消注销失败:", error);
    return NextResponse.json(
      { error: error.message || "取消注销失败" },
      { status: 400 }
    );
  }
}

/**
 * GET /api/auth/account-deletion - 获取注销状态
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = Number((session.user as any).id);
    const status = await getAccountDeletionStatus(userId);

    if (!status) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error("获取注销状态失败:", error);
    return NextResponse.json(
      { error: error.message || "获取注销状态失败" },
      { status: 500 }
    );
  }
}