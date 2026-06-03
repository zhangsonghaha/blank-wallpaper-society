import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/minio";

// GET /api/user/uploads - 获取当前用户的上传历史
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = (page - 1) * limit;
    const validStatus =
      status && ["pending", "approved", "rejected"].includes(status)
        ? status
        : null;

    // 获取总数
    const countResult = await db
      .selectFrom("images")
      .select((eb) => [eb.fn.count("id").as("total")])
      .where("uploaded_by", "=", Number(userId))
      .$if(!!validStatus, (qb) => qb.where("status", "=", validStatus!))
      .execute();
    const total = Number((countResult[0] as any)?.total) || 0;

    // 获取分页数据
    const rows = await db
      .selectFrom("images")
      .selectAll()
      .where("uploaded_by", "=", Number(userId))
      .$if(!!validStatus, (qb) => qb.where("status", "=", validStatus!))
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 统计各状态数量
    const statsResult = await db
      .selectFrom("images")
      .select(["status", (eb) => eb.fn.count("id").as("count")])
      .where("uploaded_by", "=", Number(userId))
      .groupBy("status")
      .execute();
    const stats: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    statsResult.forEach((row) => {
      if (row.status) stats[row.status] = Number(row.count);
    });

    // 今日已上传数量
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayResult = await db
      .selectFrom("images")
      .select((eb) => [eb.fn.count("id").as("count")])
      .where("uploaded_by", "=", Number(userId))
      .where("created_at", ">=", todayStart)
      .execute();
    const todayCount = Number(todayResult[0]?.count) || 0;

    return NextResponse.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
      todayCount,
      dailyLimit: 10,
    });
  } catch (error: any) {
    console.error("GET /api/user/uploads error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/user/uploads - 删除用户上传的图片
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("id");

    if (!imageId) {
      return NextResponse.json({ error: "缺少图片ID" }, { status: 400 });
    }

    // 验证图片属于当前用户
    const existing = await db
      .selectFrom("images")
      .select(["id", "storage_key", "thumbnail_url"])
      .where("id", "=", Number(imageId))
      .where("uploaded_by", "=", Number(userId))
      .execute();

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "图片不存在或无权删除" },
        { status: 403 }
      );
    }

    const image = existing[0];

    // 从数据库删除
    await db
      .deleteFrom("images")
      .where("id", "=", Number(imageId))
      .where("uploaded_by", "=", Number(userId))
      .executeTakeFirst();

    // 从 MinIO 删除文件（异步，不阻塞响应）
    try {
      if (image.storage_key) {
        await deleteFile(image.storage_key);
      }
      // 尝试删除缩略图
      if (image.thumbnail_url) {
        const thumbKey = image.thumbnail_url.split("/").slice(-2).join("/");
        if (thumbKey && thumbKey.startsWith("images/")) {
          await deleteFile(thumbKey);
        }
      }
    } catch (err) {
      console.warn("MinIO文件删除失败:", err);
    }

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    console.error("DELETE /api/user/uploads error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
