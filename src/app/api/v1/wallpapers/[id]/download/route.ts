import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { authenticateApiRequest, recordUsage } from "@/lib/api-auth";

// GET /api/v1/wallpapers/[id]/download - 获取壁纸下载链接
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return auth.error!;
  }

  try {
    const { id } = await params;
    const wallpaperId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const resolution = searchParams.get("resolution"); // e.g. "1920x1080"

    const rows = await db
      .selectFrom("images")
      .selectAll()
      .where("id", "=", wallpaperId)
      .where("status", "=", "approved")
      .execute();

    if (rows.length === 0) {
      recordUsage(auth.apiKeyInfo?.id, `/api/v1/wallpapers/${id}/download`, auth.ipAddress, 404);
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "壁纸不存在" } },
        { status: 404, headers: auth.rateLimitHeaders }
      );
    }

    const image = rows[0] as any;

    // 增加下载计数
    await db
      .updateTable("images")
      .set({ download_count: sql`download_count + 1` })
      .where("id", "=", wallpaperId)
      .executeTakeFirst();

    // 构建下载URL（指向内部下载API）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    let downloadUrl = `${baseUrl}/api/images/${id}/download`;
    if (resolution) {
      downloadUrl += `?resolution=${encodeURIComponent(resolution)}`;
    }

    recordUsage(auth.apiKeyInfo?.id, `/api/v1/wallpapers/${id}/download`, auth.ipAddress, 200);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: image.id,
          title: image.title,
          download_url: downloadUrl,
          width: image.width,
          height: image.height,
          file_size: image.file_size,
          mime_type: image.mime_type,
          available_resolutions: [
            "1920x1080",
            "2560x1440",
            "3840x2160",
          ],
        },
      },
      { headers: auth.rateLimitHeaders }
    );
  } catch (error: any) {
    recordUsage(auth.apiKeyInfo?.id, `/api/v1/wallpapers/unknown/download`, auth.ipAddress, 500);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
