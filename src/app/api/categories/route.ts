import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/categories - 获取分类列表
export async function GET() {
  try {
    const rows = await query(
      "SELECT * FROM categories ORDER BY sort_order ASC"
    );
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/categories - 新增分类（管理员）
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, sort_order } = body;

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: "分类名称和标识不能为空" }, { status: 400 });
    }

    // 检查slug是否重复
    const existing = await query("SELECT id FROM categories WHERE slug = ?", [slug.trim()]);
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: "分类标识已存在" }, { status: 400 });
    }

    // 检查name是否重复
    const existingName = await query("SELECT id FROM categories WHERE name = ?", [name.trim()]);
    if ((existingName as any[]).length > 0) {
      return NextResponse.json({ error: "分类名称已存在" }, { status: 400 });
    }

    const order = sort_order ?? 0;
    const result = await query(
      "INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)",
      [name.trim(), slug.trim(), order]
    );

    return NextResponse.json({ 
      id: (result as any).insertId, 
      name: name.trim(), 
      slug: slug.trim(), 
      sort_order: order 
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/categories - 更新分类（管理员）
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, slug, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少分类ID" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      // 检查name是否重复（排除自身）
      const existingName = await query("SELECT id FROM categories WHERE name = ? AND id != ?", [name.trim(), id]);
      if ((existingName as any[]).length > 0) {
        return NextResponse.json({ error: "分类名称已存在" }, { status: 400 });
      }
      updates.push("name = ?");
      params.push(name.trim());
    }
    if (slug !== undefined) {
      // 检查slug是否重复（排除自身）
      const existing = await query("SELECT id FROM categories WHERE slug = ? AND id != ?", [slug.trim(), id]);
      if ((existing as any[]).length > 0) {
        return NextResponse.json({ error: "分类标识已存在" }, { status: 400 });
      }
      updates.push("slug = ?");
      params.push(slug.trim());
    }
    if (sort_order !== undefined) {
      updates.push("sort_order = ?");
      params.push(sort_order);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "没有更新内容" }, { status: 400 });
    }

    params.push(id);
    await query(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`, params);

    return NextResponse.json({ message: "更新成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/categories - 删除分类（管理员）
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "缺少分类ID" }, { status: 400 });
    }

    // 检查是否有图片使用此分类
    const imagesCount = await query(
      "SELECT COUNT(*) as count FROM images WHERE category = (SELECT slug FROM categories WHERE id = ?)",
      [id]
    );
    if ((imagesCount as any[])[0]?.count > 0) {
      return NextResponse.json({ 
        error: `该分类下有 ${(imagesCount as any[])[0].count} 张图片，无法删除` 
      }, { status: 400 });
    }

    const result = await query("DELETE FROM categories WHERE id = ?", [id]);
    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}