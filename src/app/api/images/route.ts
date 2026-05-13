import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/images - 获取图片列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const offset = (page - 1) * limit;

    let sql = "SELECT * FROM images WHERE 1=1";
    const params: any[] = [];

    if (category && category !== "all") {
      sql += " AND category = ?";
      params.push(category);
    }

    if (search) {
      sql += " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    // 获取总数
    const countResult = await query(
      `SELECT COUNT(*) as total FROM images WHERE 1=1${
        category && category !== "all" ? " AND category = ?" : ""
      }${search ? " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)" : ""}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(String(limit), String(offset));

    const rows = await query(sql, params);

    return NextResponse.json({
      data: rows,
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