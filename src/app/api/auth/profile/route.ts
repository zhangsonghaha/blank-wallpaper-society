import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMinioClient, PUBLIC_URL_BASE, BUCKET_NAME } from "@/lib/minio";
import sharp from "sharp";
import { sanitizeName } from "@/lib/sanitize";
import { hashPassword, verifyPassword } from "@/lib/password";

// PATCH /api/auth/profile - 更新用户信息
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const contentType = request.headers.get("content-type") || "";

    // === 头像上传（FormData）===
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const avatarFile = formData.get("avatar") as File | null;
      if (!avatarFile) {
        return NextResponse.json({ error: "请选择头像文件" }, { status: 400 });
      }

      // 校验文件类型
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(avatarFile.type)) {
        return NextResponse.json({ error: "仅支持 JPG/PNG/WebP/GIF 格式" }, { status: 400 });
      }

      // 限制大小 2MB
      if (avatarFile.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "头像文件不能超过 2MB" }, { status: 400 });
      }

      // 读取文件缓冲区
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      // 用 sharp 压缩和裁剪为正方形
      const processedBuffer = await sharp(buffer)
        .resize(256, 256, { fit: "cover", position: "center" })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 上传到 MinIO
      const timestamp = Date.now();
      const storageKey = `avatars/${userId}_${timestamp}.jpg`;

      const minioClient = getMinioClient();
      await minioClient.putObject(BUCKET_NAME, storageKey, processedBuffer, processedBuffer.length, {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      });

      const avatarUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

      // 更新数据库
      await query("UPDATE users SET avatar = ? WHERE id = ?", [avatarUrl, userId]);

      return NextResponse.json({
        message: "头像已更新",
        avatar: avatarUrl,
      });
    }

    // === JSON 更新（昵称/密码）===
    const body = await request.json();
    const { name, currentPassword, newPassword } = body;

    // 修改密码
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "新密码至少 6 个字符" }, { status: 400 });
      }

      // 验证当前密码
      const users = (await query("SELECT password FROM users WHERE id = ?", [
        userId,
      ])) as any[];
      if (users.length === 0) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      const { valid, upgradedHash } = await verifyPassword(currentPassword, users[0].password);
      if (!valid) {
        return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
      }

      const newHash = await hashPassword(newPassword);
      await query("UPDATE users SET password = ? WHERE id = ?", [
        upgradedHash || newHash,
        userId,
      ]);

      return NextResponse.json({ message: "密码修改成功" });
    }

    // 修改昵称
    if (name !== undefined) {
      const cleanName = sanitizeName(name);
      if (!cleanName || cleanName.trim().length === 0) {
        return NextResponse.json({ error: "昵称不能为空" }, { status: 400 });
      }
      if (cleanName.length > 50) {
        return NextResponse.json({ error: "昵称最长 50 个字符" }, { status: 400 });
      }
      await query("UPDATE users SET name = ? WHERE id = ?", [cleanName.trim(), userId]);
    }

    return NextResponse.json({ message: "更新成功" });
  } catch (error: any) {
    console.error("PATCH /api/auth/profile error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}

// GET /api/auth/profile - 获取用户信息
export async function GET() {
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