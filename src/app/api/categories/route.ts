import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/categories - 获取分类列表（含图片计数）
export async function GET() {
  try {
    // 获取所有分类及其图片数量
    const rows = await db
      .selectFrom("categories as c")
      .leftJoin("images as i", (join) =>
        join
          .onRef("i.category", "=", "c.slug")
          .on("i.status", "=", "approved")
      )
      .select(["c.id", "c.name", "c.slug", "c.sort_order", "c.created_at"])
      .select((eb) => [eb.fn.count<number>("i.id").as("image_count")])
      .groupBy("c.id")
      .orderBy("c.sort_order", "asc")
      .execute();

    // 查询未分类的图片数量
    const uncategorizedRow = await db
      .selectFrom("images")
      .select((eb) => [eb.fn.count<number>("id").as("count")])
      .where((eb) => eb.or([
        eb("category", "is", null),
        eb("category", "=", ""),
      ]))
      .where("status", "=", "approved")
      .executeTakeFirst();

    // 添加"未分类"选项
    const uncategorized = {
      id: 0,
      name: "未分类",
      slug: "uncategorized",
      sort_order: 999,
      image_count: Number(uncategorizedRow?.count ?? 0),
      created_at: new Date().toISOString()
    };

    return NextResponse.json([...rows, uncategorized]);
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
    const existing = await db
      .selectFrom("categories")
      .select("id")
      .where("slug", "=", slug.trim())
      .execute();
    if (existing.length > 0) {
      return NextResponse.json({ error: "分类标识已存在" }, { status: 400 });
    }

    // 检查name是否重复
    const existingName = await db
      .selectFrom("categories")
      .select("id")
      .where("name", "=", name.trim())
      .execute();
    if (existingName.length > 0) {
      return NextResponse.json({ error: "分类名称已存在" }, { status: 400 });
    }

    const order = sort_order ?? 0;
    const result = await db
      .insertInto("categories")
      .values({ name: name.trim(), slug: slug.trim(), sort_order: order })
      .executeTakeFirst();

    return NextResponse.json({
      id: Number(result.insertId),
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

    const updateObj: Record<string, any> = {};

    if (name !== undefined) {
      // 检查name是否重复（排除自身）
      const existingName = await db
        .selectFrom("categories")
        .select("id")
        .where("name", "=", name.trim())
        .where("id", "!=", id)
        .execute();
      if (existingName.length > 0) {
        return NextResponse.json({ error: "分类名称已存在" }, { status: 400 });
      }
      updateObj.name = name.trim();
    }
    if (slug !== undefined) {
      // 检查slug是否重复（排除自身）
      const existing = await db
        .selectFrom("categories")
        .select("id")
        .where("slug", "=", slug.trim())
        .where("id", "!=", id)
        .execute();
      if (existing.length > 0) {
        return NextResponse.json({ error: "分类标识已存在" }, { status: 400 });
      }
      updateObj.slug = slug.trim();
    }
    if (sort_order !== undefined) {
      updateObj.sort_order = sort_order;
    }

    if (Object.keys(updateObj).length === 0) {
      return NextResponse.json({ error: "没有更新内容" }, { status: 400 });
    }

    await db
      .updateTable("categories")
      .set(updateObj)
      .where("id", "=", id)
      .executeTakeFirst();

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
    const imagesCountRow = await db
      .selectFrom("images")
      .select((eb) => [eb.fn.count<number>("id").as("count")])
      .where("category", "=", (
        db.selectFrom("categories").select("slug").where("id", "=", id) as any
      ))
      .executeTakeFirst();

    if (Number(imagesCountRow?.count ?? 0) > 0) {
      return NextResponse.json({
        error: `该分类下有 ${imagesCountRow?.count} 张图片，无法删除`
      }, { status: 400 });
    }

    const result = await db.deleteFrom("categories").where("id", "=", id).executeTakeFirst();
    if (Number(result.numDeletedRows) === 0) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    return NextResponse.json({ message: "删除成功" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
