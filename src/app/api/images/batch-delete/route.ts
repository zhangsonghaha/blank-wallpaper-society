import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/minio";
import { auth } from "@/lib/auth";

// POST /api/images/batch-delete - 批量删除图片
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "请选择要删除的图片" }, { status: 400 });
    }

    // 限制单次批量删除数量
    if (ids.length > 100) {
      return NextResponse.json({ error: "单次最多删除100张图片" }, { status: 400 });
    }

    let deletedCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const image = await db
          .selectFrom("images")
          .where("id", "=", Number(id))
          .selectAll()
          .executeTakeFirst();

        if (!image) {
          errors.push(`图片 ${id} 不存在`);
          continue;
        }

        // 删除 MinIO 中的文件
        try {
          await deleteFile(image.storage_key);
          if (image.thumbnail_url) {
            const thumbKey = image.thumbnail_url.split("/").slice(-2).join("/");
            await deleteFile(thumbKey);
          }
        } catch (err) {
          console.warn(`删除 MinIO 文件失败 (id=${id}):`, err);
        }

        // 删除数据库记录
        await db.deleteFrom("images").where("id", "=", Number(id)).execute();
        deletedCount++;
      } catch (err: any) {
        errors.push(`图片 ${id} 删除失败: ${err.message}`);
      }
    }

    return NextResponse.json({
      message: `成功删除 ${deletedCount} 张图片`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
