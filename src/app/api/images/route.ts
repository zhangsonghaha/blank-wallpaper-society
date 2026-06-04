import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { hexToRgb, colorDistance } from "@/lib/color-extract";
import {
  isMeilisearchAvailable,
  searchWallpapers,
  SearchOptions,
} from "@/lib/meilisearch";
import { sanitizeQueryParam, sanitizeStrict } from "@/lib/sanitize";
import { getCache, setCache, CacheKeys, CacheTTL } from "@/lib/redis";

// GET /api/images - 获取图片列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search") ? sanitizeQueryParam(searchParams.get("search")!) : null;
    const color = searchParams.get("color");
    const colorThreshold = parseInt(searchParams.get("colorThreshold") || "30");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const offset = (page - 1) * limit;

    // 高级筛选参数
    const minWidth = searchParams.get("minWidth") ? parseInt(searchParams.get("minWidth")!) : null;
    const maxWidth = searchParams.get("maxWidth") ? parseInt(searchParams.get("maxWidth")!) : null;
    const minHeight = searchParams.get("minHeight") ? parseInt(searchParams.get("minHeight")!) : null;
    const maxHeight = searchParams.get("maxHeight") ? parseInt(searchParams.get("maxHeight")!) : null;
    const resolutionPreset = searchParams.get("resolution"); // e.g. "1920x1080"
    const dateFrom = searchParams.get("dateFrom"); // e.g. "2026-01-01"
    const dateTo = searchParams.get("dateTo"); // e.g. "2026-12-31"
    const tags = searchParams.get("tags"); // 逗号分隔的标签

    // "我的图片"模式：只返回当前用户上传的图片
    const myImages = searchParams.get("my") === "true";
    let myUserId: number | null = null;
    if (myImages) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
      }
      myUserId = (session.user as any).id;
    }

    // 默认只显示已通过审核的图片（前台用户可见）
    const showAll = searchParams.get("showAll") === "true";

    // 缓存检查：仅公开请求（非 my、非 showAll）
    const isPublicRequest = !myImages && !showAll;
    let cacheKey: string | null = null;
    if (isPublicRequest) {
      const cacheParams: Record<string, string> = {};
      for (const [k, v] of searchParams.entries()) {
        if (v && k !== "my" && k !== "showAll") cacheParams[k] = v;
      }
      cacheKey = CacheKeys.IMAGES_LIST(JSON.stringify(Object.entries(cacheParams).sort()));
      const cached = await getCache<any>(cacheKey);
      if (cached) return NextResponse.json(cached);
    }

    // 优先使用 Meilisearch 搜索（仅在有搜索关键词且无高级筛选时）
    const useMeilisearch =
      search &&
      !minWidth && !maxWidth && !minHeight && !maxHeight &&
      !resolutionPreset && !dateFrom && !dateTo && !tags &&
      (await isMeilisearchAvailable());

    if (useMeilisearch) {
      const sortMap: Record<string, "newest" | "popular" | "downloads"> = {
        latest: "newest",
        popular: "popular",
      };
      const meiliResult = await searchWallpapers(search, {
        category: category || undefined,
        sort: sortMap[searchParams.get("sort") || ""] || undefined,
        page,
        limit,
      });
      if (meiliResult) {
        // 颜色筛选在应用层处理
        if (color) {
          const targetRgb = hexToRgb(color);
          const filtered = meiliResult.data.filter((item: any) => {
            if (!item.dominant_color) return false;
            const dominantRgb = hexToRgb(item.dominant_color);
            const dist = colorDistance(targetRgb, dominantRgb);
            let paletteMatch = false;
            if (item.color_palette) {
              for (const pc of item.color_palette) {
                const pRgb = hexToRgb(pc);
                if (colorDistance(targetRgb, pRgb) <= colorThreshold) {
                  paletteMatch = true;
                  break;
                }
              }
            }
            return dist <= colorThreshold || paletteMatch;
          });
          filtered.sort((a: any, b: any) => {
            const distA = colorDistance(targetRgb, hexToRgb(a.dominant_color));
            const distB = colorDistance(targetRgb, hexToRgb(b.dominant_color));
            return distA - distB;
          });
          const meiliColorResponse = {
            data: filtered,
            total: filtered.length,
            page,
            limit,
            totalPages: Math.ceil(filtered.length / limit),
            _searchEngine: "meilisearch",
          };
          if (cacheKey) setCache(cacheKey, meiliColorResponse, CacheTTL.IMAGES_LIST).catch(() => {});
          return NextResponse.json(meiliColorResponse);
        }
        const meiliResponse = { ...meiliResult, _searchEngine: "meilisearch" };
        if (cacheKey) setCache(cacheKey, meiliResponse, CacheTTL.IMAGES_LIST).catch(() => {});
        return NextResponse.json(meiliResponse);
      }
    }

    // Build query with Kysely
    let query = db.selectFrom("images").selectAll();

    // "我的图片"模式：按用户过滤，显示所有状态
    if (myImages && myUserId) {
      query = query.where("uploaded_by", "=", myUserId);
    } else {
      if (!showAll) {
        query = query.where("status", "=", "approved");
      }
    }

    if (category && category !== "all") {
      if (category === "uncategorized") {
        query = query.where((eb) =>
          eb.or([
            eb("category", "is", null),
            eb("category", "=", ""),
          ])
        );
      } else {
        query = query.where("category", "=", category);
      }
    }

    if (search) {
      const like = `%${search}%`;
      query = query.where((eb) =>
        eb.or([
          eb("title", "like", like),
          eb("description", "like", like),
          eb("tags", "like", like),
        ])
      );
    }

    // 颜色筛选支持
    if (color) {
      query = query.where("dominant_color", "is not", null);
    }

    // 分辨率筛选
    if (resolutionPreset) {
      const [w, h] = resolutionPreset.split("x").map(Number);
      if (w && h) {
        query = query.where((eb) =>
          eb.or([
            eb.and([eb("width", "=", w), eb("height", "=", h)]),
            eb.and([eb("width", "=", h), eb("height", "=", w)]),
          ])
        );
      }
    }
    if (minWidth) {
      query = query.where("width", ">=", minWidth);
    }
    if (maxWidth) {
      query = query.where("width", "<=", maxWidth);
    }
    if (minHeight) {
      query = query.where("height", ">=", minHeight);
    }
    if (maxHeight) {
      query = query.where("height", "<=", maxHeight);
    }

    // 时间范围筛选
    if (dateFrom) {
      query = query.where("created_at", ">=", new Date(dateFrom));
    }
    if (dateTo) {
      query = query.where("created_at", "<=", new Date(`${dateTo}T23:59:59`));
    }

    // 标签筛选
    if (tags) {
      const tagList = tags.split(",").map((t) => sanitizeStrict(t.trim())).filter(Boolean);
      if (tagList.length > 0) {
        query = query.where((eb) =>
          eb.and(
            tagList.map((tag) => eb("tags", "like", `%${tag}%`))
          )
        );
      }
    }

    // 获取总数（需要清除 selectAll 以避免 SELECT *, count(*) 冲突）
    const countResult = await query
      .clearSelect()
      .select((eb) => eb.fn.countAll().as("count"))
      .executeTakeFirst();
    let total = Number(countResult?.count ?? 0);

    // 获取分页数据
    const rows = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    // 应用层颜色筛选
    let filteredRows = rows;
    if (color) {
      const targetRgb = hexToRgb(color);
      filteredRows = rows.filter((row) => {
        if (!row.dominant_color) return false;
        const dominantRgb = hexToRgb(row.dominant_color);
        const dist = colorDistance(targetRgb, dominantRgb);

        // 同时检查调色板
        let paletteMatch = false;
        if (row.color_palette) {
          try {
            const palette: string[] = JSON.parse(row.color_palette);
            for (const pc of palette) {
              const pRgb = hexToRgb(pc);
              if (colorDistance(targetRgb, pRgb) <= colorThreshold) {
                paletteMatch = true;
                break;
              }
            }
          } catch {
            /* ignore */
          }
        }
        return dist <= colorThreshold || paletteMatch;
      });
      // 按色差排序
      filteredRows.sort((a, b) => {
        const distA = colorDistance(targetRgb, hexToRgb(a.dominant_color!));
        const distB = colorDistance(targetRgb, hexToRgb(b.dominant_color!));
        return distA - distB;
      });
      total = filteredRows.length;
    }

    // 零结果推荐：搜索无结果时返回随机8张推荐
    let recommendations: any[] | null = null;
    if (search && filteredRows.length === 0) {
      const recRows = await db
        .selectFrom("images")
        .where("status", "=", "approved")
        .orderBy(sql`RAND()`)
        .limit(8)
        .selectAll()
        .execute();
      recommendations = recRows;
    }

    const kyselyResponse = {
      data: filteredRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ...(recommendations ? { recommendations } : {}),
    };
    if (cacheKey) setCache(cacheKey, kyselyResponse, CacheTTL.IMAGES_LIST).catch(() => {});
    return NextResponse.json(kyselyResponse);
  } catch (error: any) {
    console.error("GET /api/images error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/images - 创建图片记录（配合上传使用）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      filename,
      storage_key,
      url,
      thumbnail_url,
      width,
      height,
      file_size,
      mime_type,
      author,
      tags,
      category,
    } = body;

    if (!storage_key || !url) {
      return NextResponse.json(
        { error: "storage_key 和 url 是必填项" },
        { status: 400 }
      );
    }

    const result = await db
      .insertInto("images")
      .values({
        title: title || "",
        description: description || "",
        filename: filename || "",
        storage_key,
        url,
        thumbnail_url: thumbnail_url || null,
        width: width || 0,
        height: height || 0,
        file_size: file_size || 0,
        mime_type: mime_type || "image/jpeg",
        author: author || "",
        tags: tags || "",
        category: category || "",
      })
      .executeTakeFirst();

    const insertId = (result as any).insertId;

    return NextResponse.json(
      { id: insertId, message: "创建成功" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/images error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
