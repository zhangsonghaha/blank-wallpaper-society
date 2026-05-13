import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// PATCH /api/auth/profile - 更新用户信息
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // 检查是否是 FormData（头像上传）
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // 头像上传 - 简化处理，只记录 URL
      // 实际项目中应该上传到 MinIO
      const formData = await request.formData();
      const avatarFile = formData.get("avatar") as File | null;

      if (!avatarFile) {
        return NextResponse.json({ error: "请选择头像文件" }, { status: 400 });
      }

      // 生成头像 URL（使用当前域名 + 时间戳）
      const timestamp = Date.now();
      const avatarUrl = `/avatars/${userId}_${timestamp}.jpg`;

      await query("UPDATE users SET avatar = ? WHERE id = ?", [
        avatarUrl,
        userId,
      ]);

      return NextResponse.json({ message: "头像已更新", avatar: avatarUrl });
    }

    // JSON 更新
    const body = await request.json();
    const { name } = body;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: "昵称不能为空" }, { status: 400 });
      }
      if (name.length > 50) {
        return NextResponse.json(
          { error: "昵称最长 50 个字符" },
          { status: 400 }
        );
      }

      await query("UPDATE users SET name = ? WHERE id = ?", [
        name.trim(),
        userId,
      ]);
    }

    return NextResponse.json({ message: "更新成功" });
  } catch (error: any) {
    console.error("PATCH /api/auth/profile error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/auth/profile - 获取用户信息
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const users = (await query(
      "SELECT id, email, name, avatar, role, created_at FROM users WHERE id = ?",
      [userId]
    )) as any[];

    if (users.length === 0) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json(users[0]);
  } catch (error: any) {
    console.error("GET /api/auth/profile error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}