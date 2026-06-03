import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hammingDistance } from "@/lib/phash";

// pHash 去重阈值
const PHASH_THRESHOLD = 5;

/**
 * GET /api/admin/duplicates
 * 扫描数据库中所有图片，按 pHash 相似度分组，返回重复组列表
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 查询所有有 pHash 的图片
    const images = await db
      .selectFrom("images")
      .select(["id", "title", "url", "thumbnail_url", "phash", "created_at"])
      .where("phash", "is not", null)
      .orderBy("created_at", "asc")
      .execute();

    // 使用并查集（Union-Find）分组
    const parent: Map<number, number> = new Map();

    const find = (x: number): number => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) {
        parent.set(ra, rb);
      }
    };

    // 两两比较 pHash
    for (let i = 0; i < images.length; i++) {
      for (let j = i + 1; j < images.length; j++) {
        if (
          images[i].phash &&
          images[j].phash &&
          hammingDistance(images[i].phash!, images[j].phash!) <= PHASH_THRESHOLD
        ) {
          union(images[i].id, images[j].id);
        }
      }
    }

    // 按分组聚合
    const groups: Map<number, any[]> = new Map();
    for (const img of images) {
      const root = find(img.id);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(img);
    }

    // 只返回包含 2 张及以上图片的组（即重复组）
    const duplicateGroups = Array.from(groups.values())
      .filter((group) => group.length >= 2)
      .map((group) => {
        // 计算组内最大距离
        let maxDistance = 0;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const dist = hammingDistance(group[i].phash!, group[j].phash!);
            if (dist > maxDistance) maxDistance = dist;
          }
        }

        return {
          images: group.map((img) => ({
            id: img.id,
            title: img.title,
            url: img.url,
            thumbnail_url: img.thumbnail_url,
            phash: img.phash,
            created_at: img.created_at,
          })),
          maxDistance,
          similarity: Math.round(((64 - maxDistance) / 64) * 100),
        };
      })
      // 按相似度排序（高相似度在前）
      .sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      totalGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.images.length, 0),
      groups: duplicateGroups,
    });
  } catch (error: any) {
    console.error("GET /api/admin/duplicates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/duplicates
 * 批量删除指定的重复图片 ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body as { ids: number[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "请提供要删除的图片ID列表" }, { status: 400 });
    }

    // 批量删除
    const deletedCount = await db
      .deleteFrom("images")
      .where("id", "in", ids)
      .execute();

    return NextResponse.json({
      message: `成功删除 ${deletedCount} 张重复图片`,
      deletedCount,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/duplicates error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}