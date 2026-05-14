import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { deleteFile } from "@/lib/minio";
import { auth } from "@/lib/auth";

// GET /api/images/[id] - 获取单张图片
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await query("SELECT * FROM images WHERE id = ?", [id]);

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    // 增加浏览次数
    await query("UPDATE images SET view_count = view_count + 1 WHERE id = ?", [id]);

    return NextResponse.json((rows as any[])[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/images/[id] - 更新图片信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, author, tags, category, is_favorite } = body;

    // is_favorite 需要用户登录，操作 favorites 表
    if (is_favorite !== undefined) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      const userId = (session.user as any).id;

      if (is_favorite) {
        // 添加收藏（忽略重复）
        await query(
          `INSERT IGNORE INTO favorites (user_id, image_id) VALUES (?, ?)`,
          [userId, id]
        );
      } else {
        // 取消收藏
        await query(
          `DELETE FROM favorites WHERE user_id = ? AND image_id = ?`,
          [userId, id]
        );
      }

      // 如果只有 is_favorite 字段，直接返回
      if (
        title === undefined &&
        description === undefined &&
        author === undefined &&
        tags === undefined &&
        category === undefined
      ) {
        return NextResponse.json({ success: true, message: "更新成功" });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push("title = ?");
      values.push(title);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }
    if (author !== undefined) {
      updates.push("author = ?");
      values.push(author);
    }
    if (tags !== undefined) {
      updates.push("tags = ?");
      values.push(tags);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      values.push(category);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    values.push(id);
    await query(
      `UPDATE images SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: "更新成功" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/images/[id] - 删除图片
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await query("SELECT * FROM images WHERE id = ?", [id]);

    if ((rows as any[]).length === 0) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }

    const image = (rows as any[])[0];

    // 删除 MinIO 中的文件
    try {
      await deleteFile(image.storage_key);
      if (image.thumbnail_url) {
        const thumbKey = image.thumbnail_url.split("/").slice(-2).join("/");
        await deleteFile(thumbKey);
      }
    } catch (err) {
      console.warn("删除 MinIO 文件失败:", err);
    }

    // 删除数据库记录
    await query("DELETE FROM images WHERE id = ?", [id]);

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}