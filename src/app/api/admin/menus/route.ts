import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET - 获取菜单列表（树形结构）
export async function GET(request: NextRequest) {
  try {
    const rows = await query("SELECT * FROM sys_menus ORDER BY sort_order ASC, id ASC") as any[];

    // 构建树形结构
    const buildTree = (items: any[], parentId: number = 0): any[] => {
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

    const result = await query(
      `INSERT INTO sys_menus (parent_id, name, path, icon, sort_order, is_visible, is_enabled, type, permission, component)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [parent_id || 0, name, path || '', icon || '', sort_order || 0, is_visible ?? 1, is_enabled ?? 1, type || 'menu', permission || '', component || '']
    ) as any;

    return NextResponse.json({ success: true, data: { id: result.insertId, ...body } });
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

    await query(
      `UPDATE sys_menus SET parent_id=?, name=?, path=?, icon=?, sort_order=?, is_visible=?, is_enabled=?, type=?, permission=?, component=? WHERE id=?`,
      [parent_id || 0, name, path || '', icon || '', sort_order || 0, is_visible ?? 1, is_enabled ?? 1, type || 'menu', permission || '', component || '', id]
    );

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

    // 检查是否有子菜单
    const children = await query("SELECT id FROM sys_menus WHERE parent_id = ?", [Number(id)]) as any[];
    if (children.length > 0) {
      return NextResponse.json({ success: false, error: "该菜单下有子菜单，无法删除" }, { status: 400 });
    }

    await query("DELETE FROM sys_menus WHERE id = ?", [Number(id)]);
    // 同时删除角色-菜单关联
    await query("DELETE FROM sys_role_menus WHERE menu_id = ?", [Number(id)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除菜单失败:", error);
    return NextResponse.json({ success: false, error: "删除菜单失败" }, { status: 500 });
  }
}