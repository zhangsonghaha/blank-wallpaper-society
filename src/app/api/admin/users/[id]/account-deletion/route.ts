import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { suspendAccount, unsuspendAccount, deleteAccountByAdmin } from "@/lib/account-deletion";
import { delCache, clearPattern } from "@/lib/redis";

/**
 * POST /api/admin/users/[id]/account-deletion - 管理员操作账号（封禁/解封/删除）
 * body: { action: 'suspend' | 'unsuspend' | 'delete', reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id);
    const operatorId = Number((session.user as any).id);

    if (isNaN(userId)) {
      return NextResponse.json({ error: "无效的用户ID" }, { status: 400 });
    }

    // 不能操作自己
    if (userId === operatorId) {
      return NextResponse.json({ error: "不能操作自己的账号" }, { status: 400 });
    }

    const body = await request.json();
    const { action, reason } = body;

    switch (action) {
      case "suspend": {
        if (!reason || !reason.trim()) {
          return NextResponse.json({ error: "请输入封禁原因" }, { status: 400 });
        }
        await suspendAccount(userId, operatorId, reason.trim());
        break;
      }
      case "unsuspend": {
        await unsuspendAccount(userId, operatorId);
        break;
      }
      case "delete": {
        if (!reason || !reason.trim()) {
          return NextResponse.json({ error: "请输入删除原因" }, { status: 400 });
        }
        await deleteAccountByAdmin(userId, operatorId, reason.trim());
        break;
      }
      default: {
        // 兼容：如果只传了 reason 没传 action，默认为 delete
        if (reason) {
          await deleteAccountByAdmin(userId, operatorId, reason);
        } else {
          return NextResponse.json({ error: "无效的操作类型" }, { status: 400 });
        }
      }
    }

    // 清除缓存
    await delCache(`admin:user:${userId}`);
    await clearPattern("admin:users:*");

    return NextResponse.json({ message: "操作成功" });
  } catch (error: any) {
    console.error("管理员账号操作失败:", error);
    return NextResponse.json(
      { error: error.message || "操作失败" },
      { status: 400 }
    );
  }
}