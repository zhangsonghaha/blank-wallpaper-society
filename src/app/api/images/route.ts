import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hexToRgb, colorDistance } from "@/lib/color-extract";

// GET /api/images - 获取图片列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
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

    let sql = "SELECT * FROM images WHERE 1=1";
    const params: any[] = [];

    // 默认只显示已通过审核的图片（前台用户可见）
    const showAll = searchParams.get("showAll") === "true";
    if (!showAll) {
      sql += " AND status = 'approved'";
    }

    if (category && category !== "all") {
      sql += " AND category = ?";
      params.push(category);
    }

    if (search) {
      sql += " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    // 颜色筛选支持
    if (color) {
      sql += " AND dominant_color IS NOT NULL";
    }

    // 分辨率筛选
    if (resolutionPreset) {
      const [w, h] = resolutionPreset.split("x").map(Number);
      if (w && h) {
        sql += " AND ((width = ? AND height = ?) OR (width = ? AND height = ?))";
        params.push(String(w), String(h), String(h), String(w));
      }
    }
    if (minWidth) {
      sql += " AND width >= ?";
      params.push(String(minWidth));
    }
    if (maxWidth) {
      sql += " AND width <= ?";
      params.push(String(maxWidth));
    }
    if (minHeight) {
      sql += " AND height >= ?";
      params.push(String(minHeight));
    }
    if (maxHeight) {
      sql += " AND height <= ?";
      params.push(String(maxHeight));
    }

    // 时间范围筛选
    if (dateFrom) {
      sql += " AND created_at >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += " AND created_at <= ?";
      params.push(`${dateTo} 23:59:59`);
    }

    // 标签筛选
    if (tags) {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const tagConditions = tagList.map(() => "tags LIKE ?").join(" AND ");
        sql += ` AND (${tagConditions})`;
        tagList.forEach((tag) => params.push(`%${tag}%`));
      }
    }

    // 获取总数
    const countWhereClause =
      (!showAll ? " AND status = 'approved'" : "") +
      (category && category !== "all" ? " AND category = ?" : "") +
      (search ? " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)" : "") +
      (color ? " AND dominant_color IS NOT NULL" : "");
    const countResult = await query(
      `SELECT COUNT(*) as total FROM images WHERE 1=1${countWhereClause}`,
      params
    );

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = (await query(sql, params)) as any[];

    // 应用层颜色筛选
    let filteredRows = rows;
    let total = (countResult as any[])[0]?.total || 0;
    if (color) {
      const targetRgb = hexToRgb(color);
      filteredRows = rows.filter((row: any) => {
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
      filteredRows.sort((a: any, b: any) => {
        const distA = colorDistance(targetRgb, hexToRgb(a.dominant_color));
        const distB = colorDistance(targetRgb, hexToRgb(b.dominant_color));
        return distA - distB;
      });
      total = filteredRows.length;
    }

    return NextResponse.json({
      data: filteredRows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
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

    const result = await query(
      `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title || "",
        description || "",
        filename || "",
        storage_key,
        url,
        thumbnail_url || null,
        width || 0,
        height || 0,
        file_size || 0,
        mime_type || "image/jpeg",
        author || "",
        tags || "",
        category || "",
      ]
    );

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