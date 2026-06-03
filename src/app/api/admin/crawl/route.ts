import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { auth } from "@/lib/auth";
import { uploadFile, BUCKET_NAME, PUBLIC_URL_BASE } from "@/lib/minio";
import { extractColors } from "@/lib/color-extract";
import sharp from "sharp";
import { spawn } from "child_process";
import path from "path";

// ============================================================
// 爬取源配置
// ============================================================

const CRAWL_SOURCES = [
  {
    id: "wallhaven",
    name: "Wallhaven",
    url: "https://wallhaven.cc",
    description: "高质量壁纸社区，提供各种分辨率壁纸",
  },
  {
    id: "unsplash",
    name: "Unsplash",
    url: "https://unsplash.com",
    description: "免费高质量图片社区",
  },
  {
    id: "pexels",
    name: "Pexels",
    url: "https://www.pexels.com",
    description: "免费图片和视频素材",
  },
  {
    id: "pixabay",
    name: "Pixabay",
    url: "https://pixabay.com",
    description: "免费图片和视频素材库",
  },
];

// ============================================================
// GET /api/admin/crawl - 获取爬取源列表和爬取历史
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "sources") {
      return NextResponse.json({ sources: CRAWL_SOURCES });
    }

    // 返回爬取历史记录
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 查询爬取历史（从 crawl_logs 表查询）
    const [logResult, logCountResult] = await Promise.all([
      db.selectFrom("crawl_logs")
        .select(["id", "source", "source_url", "crawl_mode", "category", "tags", "pages", "requested_count",
                "success_count", "fail_count", "dedup_skipped", "status", "error_message",
                "started_at", "finished_at", "duration_seconds"])
        .orderBy("started_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute(),
      db.selectFrom("crawl_logs")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ]);

    // 查询爬取统计（从 images 表筛选 source 为爬虫导入的记录）
    const [historyResult, countResult] = await Promise.all([
      sql<{
        id: number; title: string; url: string; thumbnail_url: string;
        width: number; height: number; tags: string; category: string; created_at: string;
      }>`SELECT id, title, url, thumbnail_url, width, height, tags, category, created_at
         FROM images 
         WHERE description LIKE '%[crawl]%'
         ORDER BY created_at DESC 
         LIMIT ${limit} OFFSET ${offset}`.execute(db),
      sql<{ total: string | number }>`SELECT COUNT(*) as total FROM images WHERE description LIKE '%[crawl]%'`.execute(db),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      sources: CRAWL_SOURCES,
      history: historyResult.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      crawlLogs: logResult,
      crawlLogsTotal: Number(logCountResult?.total || 0),
    });
  } catch (error: any) {
    console.error("GET /api/admin/crawl error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/crawl - 启动爬虫任务
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // 管理员权限验证
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { source, mode, count, url, fetchMode, minWidth, pages, dedup, category, tags } = body;

    // 参数验证
    const isUrlMode = !!url;
    const isSourceMode = !!source;

    if (!isUrlMode && !isSourceMode) {
      return NextResponse.json(
        { error: "请提供 url（自定义URL）或 source（固定爬取源）参数" },
        { status: 400 }
      );
    }

    if (isSourceMode && !CRAWL_SOURCES.find((s) => s.id === source)) {
      return NextResponse.json(
        { error: "无效的爬取源" },
        { status: 400 }
      );
    }

    if (isUrlMode) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "无效的URL格式" },
          { status: 400 }
        );
      }
    }

    if (mode && mode !== "random" && mode !== "sequential") {
      return NextResponse.json(
        { error: "无效的爬取模式，仅支持 random/sequential" },
        { status: 400 }
      );
    }

    const crawlCount = Math.min(Math.max(parseInt(count) || 5, 1), 50);
    const crawlPages = Math.min(Math.max(parseInt(pages) || 1, 1), 10);
    const enableDedup = dedup !== false;
    const categoryValue = category || "";
    const tagsValue = tags || "";

    const crawlSource = isUrlMode ? url : source;
    const crawlModeStr = isUrlMode ? (fetchMode || "auto") : (mode || "random");
    const tagsStr = Array.isArray(tagsValue) ? tagsValue.join(",") : tagsValue;

    const logResult = await db.insertInto("crawl_logs")
      .values({
        source: isUrlMode ? new URL(url).hostname : source,
        source_url: isUrlMode ? url : (CRAWL_SOURCES.find(s => s.id === source)?.url || ""),
        crawl_mode: crawlModeStr,
        category: categoryValue,
        tags: tagsStr,
        pages: crawlPages,
        requested_count: crawlCount,
        status: "running",
        operator_id: userId,
      })
      .executeTakeFirst();
    const crawlLogId = Number(logResult.insertId);
    const startTime = Date.now();

    // 调用 Python 爬虫脚本
    const scriptPath = path.join(process.cwd(), "scripts", "crawl_with_scrapling.py");
    const crawlResult = await runCrawlScript(scriptPath, {
      url: isUrlMode ? url : undefined,
      source: isSourceMode ? source : undefined,
      mode: mode || "random",
      fetchMode: fetchMode || "auto",
      count: crawlCount,
      minWidth: parseInt(minWidth) || 800,
      pages: crawlPages,
      dedup: enableDedup,
      category: categoryValue,
      tags: tagsValue,
    });

    if (!crawlResult.success || !crawlResult.results || crawlResult.results.length === 0) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      await db.updateTable("crawl_logs")
        .set({
          status: "failed",
          error_message: crawlResult.error || "爬取未返回任何结果",
          finished_at: sql`NOW()`,
          duration_seconds: duration,
        })
        .where("id", "=", crawlLogId)
        .execute();
      return NextResponse.json(
        {
          error: crawlResult.error || "爬取未返回任何结果",
          success: false,
        },
        { status: 500 }
      );
    }

    // 创建预览会话
    const sessionResult = await db.insertInto("crawl_sessions")
      .values({
        source_url: isUrlMode ? url : (CRAWL_SOURCES.find(s => s.id === source)?.url || ""),
        source_type: isUrlMode ? "custom" : source,
        category: categoryValue,
        tags: tagsStr,
        crawl_log_id: crawlLogId,
        total_count: crawlResult.results.length,
        status: "pending",
      })
      .executeTakeFirst();
    const sessionId = Number(sessionResult.insertId);

    // 批量写入预览项
    if (crawlResult.results.length > 0) {
      const tuples = crawlResult.results.map((item: any) => {
        const isVideo = item.media_type === "video";
        return sql`(${sessionId}, ${isVideo ? (item.video_url || item.image_url) : (item.image_url || "")}, ${item.title || ""}, ${item.width || 0}, ${item.height || 0}, ${item.file_size || 0}, ${item.mime_type || (isVideo ? "video/mp4" : "image/jpeg")}, ${isVideo ? "video" : "image"}, 0, ${item.source || (isUrlMode ? new URL(url).hostname : source)}, ${Array.isArray(item.tags) ? item.tags.join(",") : (item.tags || "")}, ${item.category || categoryValue}, ${isVideo ? (item.video_url || null) : null}, ${isVideo ? (item.poster_url || null) : null})`;
      });
      await sql`INSERT INTO crawl_preview_items (session_id, source_url, title, width, height, file_size, mime_type, media_type, is_selected, source, tags, category, video_url, poster_url)
         VALUES ${sql.join(tuples)}`.execute(db);
    }

    // 更新爬取历史为完成
    const duration = Math.round((Date.now() - startTime) / 1000);
    await db.updateTable("crawl_logs")
      .set({
        status: "completed",
        success_count: crawlResult.results.length,
        finished_at: sql`NOW()`,
        duration_seconds: duration,
      })
      .where("id", "=", crawlLogId)
      .execute();

    return NextResponse.json({
      success: true,
      message: `爬取完成，共 ${crawlResult.results.length} 张图片，请选择后确认入库`,
      session_id: sessionId,
      total_count: crawlResult.results.length,
    });
  } catch (error: any) {
    console.error("POST /api/admin/crawl error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// 调用 Python 爬虫脚本
// ============================================================

interface CrawlScriptResult {
  success: boolean;
  results?: any[];
  error?: string;
}

function runCrawlScript(
  scriptPath: string,
  params: {
    url?: string;
    source?: string;
    mode: string;
    fetchMode?: string;
    count: number;
    minWidth?: number;
    pages?: number;
    dedup?: boolean;
    category?: string;
    tags?: string;
  }
): Promise<CrawlScriptResult> {
  return new Promise((resolve) => {
    const args = [scriptPath];

    if (params.url) {
      args.push("--url", params.url);
      args.push("--fetch-mode", params.fetchMode || "auto");
      if (params.minWidth) {
        args.push("--min-width", String(params.minWidth));
      }
    } else if (params.source) {
      args.push("--source", params.source);
    }

    args.push("--count", String(params.count));

    if (params.pages && params.pages > 1) {
      args.push("--pages", String(params.pages));
    }

    if (params.dedup === false) {
      args.push("--no-dedup");
    }

    if (params.category) {
      args.push("--category", params.category);
    }

    if (params.tags) {
      args.push("--tags", params.tags);
    }

    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    const proc = spawn(pythonCmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      timeout: 120000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString("utf-8");
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString("utf-8");
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("爬虫脚本退出码:", code);
        console.error("爬虫脚本stderr:", stderr);
        resolve({
          success: false,
          error: `脚本退出码 ${code}: ${stderr.slice(-500)}`,
        });
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve({
          success: result.success !== false,
          results: result.results || [],
        });
      } catch (parseError: any) {
        console.error("解析爬虫输出失败:", parseError);
        console.error("原始输出:", stdout.slice(0, 1000));
        resolve({
          success: false,
          error: `解析输出失败: ${parseError.message}`,
        });
      }
    });

    proc.on("error", (err) => {
      console.error("启动爬虫脚本失败:", err);
      resolve({
        success: false,
        error: `启动脚本失败: ${err.message}`,
      });
    });
  });
}

// ============================================================
// 处理单张爬取图片：下载 -> 上传 MinIO -> 生成缩略图 -> 写入数据库
// ============================================================

async function processCrawledImage(
  item: {
    title: string;
    image_url: string;
    source_url: string;
    source: string;
    tags: string[];
    category: string;
    width: number;
    height: number;
    filename: string;
    media_type?: string;
    poster_url?: string;
    video_url?: string;
  },
  userId: number
): Promise<any | null> {
  const isVideo = item.media_type === "video";
  const downloadUrl = (isVideo && item.video_url) ? item.video_url : item.image_url;

  if (!downloadUrl) return null;

  const imageRes = await fetch(downloadUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": new URL(item.image_url).origin + "/",
    },
    signal: AbortSignal.timeout(60000),
  });

  if (!imageRes.ok) {
    console.error(`下载失败: HTTP ${imageRes.status} - ${item.image_url}`);
    return null;
  }

  const contentType = imageRes.headers.get("content-type") || (isVideo ? "video/mp4" : "image/jpeg");
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  let width = item.width || 0;
  let height = item.height || 0;
  if (!isVideo) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      width = metadata.width || width;
      height = metadata.height || height;
    } catch {
      // sharp 无法解析时使用爬取到的尺寸
    }
  }

  const timestamp = Date.now();
  const safeName = item.filename || (isVideo ? `crawled_${timestamp}.mp4` : `crawled_${timestamp}.jpg`);
  const storageKey = isVideo
    ? `videos/${timestamp}_${safeName}`
    : `images/${timestamp}_${safeName}`;

  const minioClient = await import("@/lib/minio").then((m) => m.getMinioClient());
  await minioClient.putObject(BUCKET_NAME, storageKey, imageBuffer, imageBuffer.length, {
    "Content-Type": contentType,
  });

  const storedUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

  let thumbnailUrl = "";
  let posterStoredUrl = "";

  if (isVideo) {
    posterStoredUrl = storedUrl;
    if (item.poster_url) {
      try {
        const posterRes = await fetch(item.poster_url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(15000),
        });
        if (posterRes.ok) {
          const posterBuffer = Buffer.from(await posterRes.arrayBuffer());
          const thumbBuffer = await sharp(posterBuffer)
            .resize(400, 400, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
          const thumbResult = await uploadFile(thumbBuffer, `thumb_${timestamp}.webp`, "image/webp");
          thumbnailUrl = thumbResult.url;
        }
      } catch {
        // 封面图下载失败不影响主流程
      }
    }
  } else {
    try {
      const thumbBuffer = await sharp(imageBuffer)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const thumbResult = await uploadFile(
        thumbBuffer,
        `thumb_${timestamp}.webp`,
        "image/webp"
      );
      thumbnailUrl = thumbResult.url;
    } catch {
      // 缩略图生成失败不影响主流程
    }
  }

  let dominantColor: string | null = null;
  let colorPalette: string | null = null;
  if (!isVideo) {
    try {
      const colors = await extractColors(imageBuffer);
      dominantColor = colors.dominant;
      colorPalette = JSON.stringify(colors.palette);
    } catch {
      // 颜色提取失败不影响主流程
    }
  }

  const tagsStr = Array.isArray(item.tags) ? item.tags.join(",") : (item.tags || "");
  const description = `[crawl] 从 ${item.source} 爬取 | 源地址: ${item.source_url || item.image_url}${isVideo ? " | 动态壁纸" : ""}`;

  const result = await db.insertInto("images")
    .values({
      title: item.title || `从${item.source}爬取的${isVideo ? "动态壁纸" : "图片"}`,
      description,
      filename: safeName,
      storage_key: storageKey,
      url: isVideo ? (thumbnailUrl || storedUrl) : storedUrl,
      thumbnail_url: thumbnailUrl || null,
      width,
      height,
      file_size: imageBuffer.length,
      mime_type: contentType,
      author: `crawler-${item.source}`,
      tags: tagsStr,
      category: item.category || "",
      status: "approved",
      dominant_color: dominantColor,
      color_palette: colorPalette,
      uploaded_by: userId,
      media_type: isVideo ? "video" : "image",
      video_url: isVideo ? storedUrl : null,
      poster_url: isVideo ? (thumbnailUrl || null) : null,
    })
    .executeTakeFirst();

  const insertId = Number(result.insertId);

  return {
    id: insertId,
    title: item.title || `从${item.source}爬取的${isVideo ? "动态壁纸" : "图片"}`,
    url: isVideo ? (thumbnailUrl || storedUrl) : storedUrl,
    video_url: isVideo ? storedUrl : undefined,
    thumbnail_url: thumbnailUrl,
    width,
    height,
    tags: tagsStr,
    category: item.category,
    source: item.source,
    media_type: isVideo ? "video" : "image",
  };
}
