import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - 获取菜单列表（树形结构）
export async function GET(request: NextRequest) {
  try {
    const rows = await db.selectFrom("sys_menus")
      .selectAll()
      .orderBy("sort_order", "asc")
      .orderBy("id", "asc")
      .execute();

    // 构建树形结构
    const buildTree = (items: typeof rows, parentId: number = 0): any[] => {
      return items
        .filter(item => item.parent_id === parentId)
        .map((item): any => ({
          ...item,
          children: buildTree(items, item.id),
        }));
    };

    const tree = buildTree(rows);
    return NextResponse.json({ success: true, data: tree, flat: rows });
  } catch (error) {
    console.error("获取菜单列表失败:", error);
    return NextResponse.json({ success: false, error: "获取菜单列表失败" }, { status: 500 });
  }
}

// POST - 新增菜单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parent_id, name, path, icon, sort_order, is_visible, is_enabled, type, permission, component } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "菜单名称不能为空" }, { status: 400 });
    }

    const result = await db.insertInto("sys_menus")
      .values({
        parent_id: parent_id || 0,
        name,
        path: path || '',
        icon: icon || '',
        sort_order: sort_order || 0,
        is_visible: is_visible ?? 1,
        is_enabled: is_enabled ?? 1,
        type: type || 'menu',
        permission: permission || '',
        component: component || '',
      })
      .executeTakeFirst();

    return NextResponse.json({ success: true, data: { id: Number(result.insertId), ...body } });
  } catch (error) {
    console.error("新增菜单失败:", error);
    return NextResponse.json({ success: false, error: "新增菜单失败" }, { status: 500 });
  }
}

// PUT - 更新菜单
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, parent_id, name, path, icon, sort_order, is_visible, is_enabled, type, permission, component } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "菜单ID不能为空" }, { status: 400 });
    }

    await db.updateTable("sys_menus")
      .set({
        parent_id: parent_id || 0,
        name,
        path: path || '',
        icon: icon || '',
        sort_order: sort_order || 0,
        is_visible: is_visible ?? 1,
        is_enabled: is_enabled ?? 1,
        type: type || 'menu',
        permission: permission || '',
        component: component || '',
      })
      .where("id", "=", id)
      .execute();

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error("更新菜单失败:", error);
    return NextResponse.json({ success: false, error: "更新菜单失败" }, { status: 500 });
  }
}

// DELETE - 删除菜单
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "菜单ID不能为空" }, { status: 400 });
    }

    const numId = Number(id);

    // 检查是否有子菜单
    const children = await db.selectFrom("sys_menus")
      .where("parent_id", "=", numId)
      .select(["id"])
      .execute();
    if (children.length > 0) {
      return NextResponse.json({ success: false, error: "该菜单下有子菜单，无法删除" }, { status: 400 });
    }

    await db.deleteFrom("sys_menus").where("id", "=", numId).execute();
    // 同时删除角色-菜单关联
    await db.deleteFrom("sys_role_menus").where("menu_id", "=", numId).execute();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除菜单失败:", error);
    return NextResponse.json({ success: false, error: "删除菜单失败" }, { status: 500 });
  }
}
