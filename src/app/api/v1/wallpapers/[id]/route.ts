import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateApiRequest, recordUsage } from "@/lib/api-auth";

// GET /api/v1/wallpapers/[id] - 壁纸详情
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
    const rows = (await query(
      "SELECT * FROM images WHERE id = ? AND status = 'approved'",
      [id]
    )) as any[];

    if (rows.length === 0) {
      recordUsage(auth.apiKeyInfo?.id, `/api/v1/wallpapers/${id}`, auth.ipAddress, 404);
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "壁纸不存在" } },
        { status: 404, headers: auth.rateLimitHeaders }
      );
    }

    const row = rows[0];

    // 增加浏览次数
    await query("UPDATE images SET view_count = view_count + 1 WHERE id = ?", [id]);

    recordUsage(auth.apiKeyInfo?.id, `/api/v1/wallpapers/${id}`, auth.ipAddress, 200);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: row.id,
          title: row.title,
          description: row.description,
          url: row.url,
          thumbnail_url: row.thumbnail_url,
          width: row.width,
          height: row.height,
          file_size: row.file_size,
          mime_type: row.mime_type,
          author: row.author,
          tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
          category: row.category,
          dominant_color: row.dominant_color,
          color_palette: row.color_palette ? JSON.parse(row.color_palette) : [],
          view_count: row.view_count + 1,
          download_count: row.download_count,
          created_at: row.created_at,
        },
      },
      { headers: auth.rateLimitHeaders }
    );
  } catch (error: any) {
    recordUsage(auth.apiKeyInfo?.id, `/api/v1/wallpapers/unknown`, auth.ipAddress, 500);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}