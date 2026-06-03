import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isMeilisearchAvailable,
  ensureIndexConfig,
  indexImages,
  dbRowToSearchData,
  getIndexStats,
  getMeilisearchClient,
} from "@/lib/meilisearch";

// POST /api/admin/search-sync - 同步所有 approved 图片到 Meilisearch
export async function POST(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 检查 Meilisearch 可用性
    const available = await isMeilisearchAvailable();
    if (!available) {
      return NextResponse.json(
        { error: "Meilisearch 服务不可用，请检查配置" },
        { status: 503 }
      );
    }

    // 初始化索引配置
    await ensureIndexConfig();

    // 获取所有 approved 图片
    const images = await db
      .selectFrom("images")
      .selectAll()
      .where("status", "=", "approved")
      .execute();

    if (images.length === 0) {
      return NextResponse.json({
        message: "没有需要同步的图片",
        synced: 0,
        total: 0,
      });
    }

    // 转换为搜索数据格式
    const searchData = images.map(dbRowToSearchData);

    // 批量索引
    await indexImages(searchData);

    return NextResponse.json({
      message: "同步完成",
      synced: searchData.length,
      total: images.length,
    });
  } catch (error: any) {
    console.error("POST /api/admin/search-sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/search-sync - 清空并重建索引
export async function DELETE(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 检查 Meilisearch 可用性
    const available = await isMeilisearchAvailable();
    if (!available) {
      return NextResponse.json(
        { error: "Meilisearch 服务不可用，请检查配置" },
        { status: 503 }
      );
    }

    const client = getMeilisearchClient();
    if (!client) {
      return NextResponse.json(
        { error: "Meilisearch 客户端初始化失败" },
        { status: 500 }
      );
    }

    // 删除并重建索引
    try {
      await client.deleteIndex("wallpapers");
    } catch {
      // 索引可能不存在，忽略错误
    }

    // 重新初始化索引配置
    await ensureIndexConfig();

    // 重新同步所有 approved 图片
    const images = await db
      .selectFrom("images")
      .selectAll()
      .where("status", "=", "approved")
      .execute();

    if (images.length === 0) {
      return NextResponse.json({
        message: "索引已清空，没有需要同步的图片",
        synced: 0,
        total: 0,
      });
    }

    const searchData = images.map(dbRowToSearchData);
    await indexImages(searchData);

    return NextResponse.json({
      message: "索引重建完成",
      synced: searchData.length,
      total: images.length,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/search-sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/admin/search-sync - 获取索引状态
export async function GET(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const available = await isMeilisearchAvailable();
    if (!available) {
      return NextResponse.json({
        available: false,
        stats: null,
      });
    }

    const stats = await getIndexStats();

    // 获取数据库中 approved 图片数量
    const countResult = await db
      .selectFrom("images")
      .select((eb) => eb.fn.countAll().as("total"))
      .where("status", "=", "approved")
      .executeTakeFirst();
    const dbTotal = Number(countResult?.total ?? 0);

    return NextResponse.json({
      available: true,
      stats,
      dbTotal,
    });
  } catch (error: any) {
    console.error("GET /api/admin/search-sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
