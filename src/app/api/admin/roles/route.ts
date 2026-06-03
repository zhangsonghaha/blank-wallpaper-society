import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";

// GET - 获取角色列表
export async function GET() {
  try {
    const roles = await db.selectFrom("sys_roles")
      .selectAll()
      .orderBy("sort_order", "asc")
      .orderBy("id", "asc")
      .execute();

    // 获取每个角色的菜单权限
    for (const role of roles) {
      const menus = await db.selectFrom("sys_role_menus")
        .where("role_id", "=", role.id)
        .select(["menu_id"])
        .execute();
      (role as any).menu_ids = menus.map(m => m.menu_id);
    }
    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error("获取角色列表失败:", error);
    return NextResponse.json({ success: false, error: "获取角色列表失败" }, { status: 500 });
  }
}

// POST - 新增角色
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, description, is_enabled, sort_order, menu_ids } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: "角色名称和编码不能为空" }, { status: 400 });
    }

    // 检查编码唯一性
    const existing = await db.selectFrom("sys_roles")
      .where("code", "=", code)
      .select(["id"])
      .execute();
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: "角色编码已存在" }, { status: 400 });
    }

    const result = await db.insertInto("sys_roles")
      .values({
        name,
        code,
        description: description || '',
        is_enabled: is_enabled ?? 1,
        sort_order: sort_order || 0,
      })
      .executeTakeFirst();

    const roleId = Number(result.insertId);

    // 保存角色-菜单关联
    if (menu_ids && menu_ids.length > 0) {
      for (const menuId of menu_ids) {
        await sql`INSERT IGNORE INTO sys_role_menus (role_id, menu_id) VALUES (${roleId}, ${menuId})`.execute(db);
      }
    }

    return NextResponse.json({ success: true, data: { id: roleId, ...body } });
  } catch (error) {
    console.error("新增角色失败:", error);
    return NextResponse.json({ success: false, error: "新增角色失败" }, { status: 500 });
  }
}

// PUT - 更新角色
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, is_enabled, sort_order, menu_ids } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "角色ID不能为空" }, { status: 400 });
    }

    await db.updateTable("sys_roles")
      .set({
        name,
        description: description || '',
        is_enabled: is_enabled ?? 1,
        sort_order: sort_order || 0,
      })
      .where("id", "=", id)
      .execute();

    // 更新角色-菜单关联
    await db.deleteFrom("sys_role_menus").where("role_id", "=", id).execute();
    if (menu_ids && menu_ids.length > 0) {
      for (const menuId of menu_ids) {
        await sql`INSERT IGNORE INTO sys_role_menus (role_id, menu_id) VALUES (${id}, ${menuId})`.execute(db);
      }
    }

    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    console.error("更新角色失败:", error);
    return NextResponse.json({ success: false, error: "更新角色失败" }, { status: 500 });
  }
}

// DELETE - 删除角色
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "角色ID不能为空" }, { status: 400 });
    }

    const numId = Number(id);

    // 不允许删除内置角色
    const role = await db.selectFrom("sys_roles").where("id", "=", numId).select(["code"]).execute();
    if (role.length === 0) {
      return NextResponse.json({ success: false, error: "角色不存在" }, { status: 404 });
    }
    if (['admin', 'moderator', 'user'].includes(role[0].code)) {
      return NextResponse.json({ success: false, error: "内置角色不允许删除" }, { status: 400 });
    }

    await db.deleteFrom("sys_role_menus").where("role_id", "=", numId).execute();
    await db.deleteFrom("sys_roles").where("id", "=", numId).execute();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除角色失败:", error);
    return NextResponse.json({ success: false, error: "删除角色失败" }, { status: 500 });
  }
}
