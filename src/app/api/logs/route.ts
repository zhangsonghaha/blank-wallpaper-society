import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

// POST /api/logs - 记录浏览/下载日志
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, image_id, user_id, ip_address, resolution } = body;

    if (!type || !image_id) {
      return NextResponse.json(
        { error: "缺少必要参数: type, image_id" },
        { status: 400 }
      );
    }

    if (type !== "view" && type !== "download") {
      return NextResponse.json(
        { error: "type 只能是 view 或 download" },
        { status: 400 }
      );
    }

    // IP脱敏：只保留前两段
    const maskedIp = maskIp(ip_address || getClientIp(request));

    if (type === "download") {
      await db
        .insertInto("download_logs")
        .values({
          image_id,
          user_id: user_id || null,
          ip_address: maskedIp,
          resolution: resolution || null,
        })
        .executeTakeFirst();
    } else {
      await db
        .insertInto("view_logs")
        .values({
          image_id,
          user_id: user_id || null,
          ip_address: maskedIp,
        })
        .executeTakeFirst();
    }

    // 更新图片表的计数（浏览量）
    if (type === "view") {
      await db
        .updateTable("images")
        .set({ view_count: sql`view_count + 1` })
        .where("id", "=", image_id)
        .executeTakeFirst();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("记录日志失败:", error);
    return NextResponse.json(
      { error: error.message || "服务器错误" },
      { status: 500 }
    );
  }
}

// 获取客户端IP
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "0.0.0.0";
}

// IP脱敏：只保留前两段
function maskIp(ip: string): string {
  // IPv4: 192.168.1.1 -> 192.168.*.*
  // IPv6: 只保留前两段
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts[0]}:${parts[1]}:****`;
  }
  return "*.*.*.*";
}
