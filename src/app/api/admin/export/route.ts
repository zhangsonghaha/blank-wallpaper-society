import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

// GET /api/admin/export?type=users|images|downloads - 导出数据为 CSV
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "users";

    const adminId = (session.user as any).id;
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;

    let csv = "";
    let filename = "";

    switch (type) {
      case "users": {
        const rows = (await query(
          `SELECT id, name, email, role, created_at FROM users ORDER BY id`
        )) as any[];
        csv = "ID,名称,邮箱,角色,注册时间\n";
        for (const r of rows) {
          csv += `${r.id},"${(r.name || "").replace(/"/g, '""')}","${(r.email || "").replace(/"/g, '""')}",${r.role},${r.created_at}\n`;
        }
        filename = `users_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "images": {
        const rows = (await query(
          `SELECT id, title, author, category, status, width, height, download_count, view_count, created_at FROM images ORDER BY id`
        )) as any[];
        csv = "ID,标题,作者,分类,状态,宽度,高度,下载量,浏览量,上传时间\n";
        for (const r of rows) {
          csv += `${r.id},"${(r.title || "").replace(/"/g, '""')}","${(r.author || "").replace(/"/g, '""')}","${(r.category || "").replace(/"/g, '""')}",${r.status},${r.width},${r.height},${r.download_count || 0},${r.view_count || 0},${r.created_at}\n`;
        }
        filename = `images_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      case "downloads": {
        const rows = (await query(
          `SELECT dl.id, u.name as user_name, i.title as image_title, dl.resolution, dl.ip_address, dl.created_at
           FROM download_logs dl
           LEFT JOIN users u ON dl.user_id = u.id
           LEFT JOIN images i ON dl.image_id = i.id
           ORDER BY dl.created_at DESC
           LIMIT 10000`
        )) as any[];
        csv = "ID,用户,图片,分辨率,IP,下载时间\n";
        for (const r of rows) {
          csv += `${r.id},"${(r.user_name || "匿名").replace(/"/g, '""')}","${(r.image_title || "").replace(/"/g, '""')}","${r.resolution || ""}","${r.ip_address || ""}",${r.created_at}\n`;
        }
        filename = `downloads_${new Date().toISOString().slice(0, 10)}.csv`;
        break;
      }

      default:
        return NextResponse.json({ error: "不支持的导出类型" }, { status: 400 });
    }

    // 记录审计日志
    logAudit({
      operatorId: adminId,
      operation: "settings_update" as any,
      detail: { exportType: type, filename, rowCount: csv.split("\n").length - 1 },
      ip: clientIp?.split(",")[0]?.trim(),
    }).catch(() => {});

    // 返回 CSV 文件
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}