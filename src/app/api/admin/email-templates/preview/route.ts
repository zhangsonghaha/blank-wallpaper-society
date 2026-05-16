import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderEmailTemplate } from "@/lib/email-template";

// POST /api/admin/email-templates/preview - 预览模板渲染效果
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { template_key, data } = await request.json();

    if (!template_key) {
      return NextResponse.json({ error: "缺少模板标识" }, { status: 400 });
    }

    // 使用示例数据或传入的数据渲染模板
    const rendered = await renderEmailTemplate(template_key, data || {});

    if (!rendered) {
      return NextResponse.json({ error: "模板不存在或未启用" }, { status: 404 });
    }

    return NextResponse.json(rendered);
  } catch (error: any) {
    console.error("POST /api/admin/email-templates/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}