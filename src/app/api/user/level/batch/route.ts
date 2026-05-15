import { NextRequest, NextResponse } from "next/server";
import { getUserLevelsBatch } from "@/lib/user-level";

// GET /api/user/level/batch?ids=1,2,3 - 批量获取用户等级
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ error: "缺少 ids 参数" }, { status: 400 });
    }

    const userIds = idsParam.split(",").map(Number).filter((n) => !isNaN(n));

    if (userIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    if (userIds.length > 100) {
      return NextResponse.json({ error: "最多查询100个用户" }, { status: 400 });
    }

    const levelMap = await getUserLevelsBatch(userIds);

    // 转为普通对象方便 JSON 序列化
    const data: Record<number, { level: number; title: string }> = {};
    for (const [uid, info] of levelMap) {
      data[uid] = { level: info.level, title: info.title };
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("GET /api/user/level/batch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}