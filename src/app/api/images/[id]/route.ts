import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { deleteFile } from "@/lib/minio";

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
    if (is_favorite !== undefined) {
      updates.push("is_favorite = ?");
      values.push(is_favorite ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    values.push(id);
    await query(
      `UPDATE images SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    return NextResponse.json({ message: "更新成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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