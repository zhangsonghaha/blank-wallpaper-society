import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateApiRequest, recordUsage } from "@/lib/api-auth";

// GET /api/v1/categories - 分类列表
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return auth.error!;
  }

  try {
    const rows = (await query(
      "SELECT * FROM categories ORDER BY sort_order ASC"
    )) as any[];

    const categories = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sort_order: row.sort_order,
      image_count: row.image_count || 0,
    }));

    recordUsage(auth.apiKeyInfo?.id, "/api/v1/categories", auth.ipAddress, 200);

    return NextResponse.json(
      { success: true, data: categories },
      { headers: auth.rateLimitHeaders }
    );
  } catch (error: any) {
    recordUsage(auth.apiKeyInfo?.id, "/api/v1/categories", auth.ipAddress, 500);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}