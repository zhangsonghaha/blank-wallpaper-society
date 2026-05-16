import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  TemplateCategory,
  TemplateVariable,
  CATEGORY_LABELS,
  VARIABLE_GROUPS,
} from "@/lib/email-template";
import { query } from "@/lib/db";

// GET /api/admin/email-templates - 获取模板列表
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as TemplateCategory | null;

    const templates = await listEmailTemplates(category || undefined);

    return NextResponse.json({
      templates,
      categories: CATEGORY_LABELS,
      variableGroups: VARIABLE_GROUPS,
    });
  } catch (error: any) {
    console.error("GET /api/admin/email-templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/email-templates - 创建新模板
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { template_key, name, description, subject, body_html, body_text, variables, category } = body;

    // 参数验证
    if (!template_key || !name || !subject || !body_html || !category) {
      return NextResponse.json(
        { error: "缺少必填字段：template_key, name, subject, body_html, category" },
        { status: 400 }
      );
    }

    // 检查 key 是否已存在
    const existing = await query(
      "SELECT id FROM email_templates WHERE template_key = ?",
      [template_key]
    ) as any[];
    if (existing.length > 0) {
      return NextResponse.json({ error: "模板标识已存在" }, { status: 409 });
    }

    // 验证分类
    if (!CATEGORY_LABELS[category as TemplateCategory]) {
      return NextResponse.json({ error: "无效的分类" }, { status: 400 });
    }

    const id = await createEmailTemplate({
      template_key,
      name,
      description,
      subject,
      body_html,
      body_text,
      variables: variables || [],
      category,
    });

    return NextResponse.json({ id, message: "模板创建成功" }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/email-templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/email-templates - 更新模板
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, subject, body_html, body_text, variables, category, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少模板ID" }, { status: 400 });
    }

    const success = await updateEmailTemplate(id, {
      name,
      description,
      subject,
      body_html,
      body_text,
      variables,
      category,
      is_active,
    });

    if (!success) {
      return NextResponse.json({ error: "更新失败，模板可能不存在" }, { status: 404 });
    }

    return NextResponse.json({ message: "模板更新成功" });
  } catch (error: any) {
    console.error("PUT /api/admin/email-templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/email-templates - 删除模板
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");

    if (!id) {
      return NextResponse.json({ error: "缺少模板ID" }, { status: 400 });
    }

    const success = await deleteEmailTemplate(id);

    if (!success) {
      return NextResponse.json({ error: "删除失败，模板可能不存在或为内置模板" }, { status: 400 });
    }

    return NextResponse.json({ message: "模板删除成功" });
  } catch (error: any) {
    console.error("DELETE /api/admin/email-templates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}