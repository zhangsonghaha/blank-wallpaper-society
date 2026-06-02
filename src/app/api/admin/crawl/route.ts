import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
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
      // 返回可用的爬取源列表
      return NextResponse.json({ sources: CRAWL_SOURCES });
    }

    // 返回爬取历史记录
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // 查询爬取历史（从 crawl_logs 表查询）
    const [logResult, logCountResult] = await Promise.all([
      query(
        `SELECT id, source, source_url, crawl_mode, category, tags, pages, requested_count,
                success_count, fail_count, dedup_skipped, status, error_message,
                started_at, finished_at, duration_seconds
         FROM crawl_logs 
         ORDER BY started_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM crawl_logs`
      ),
    ]);

    // 查询爬取统计（从 images 表筛选 source 为爬虫导入的记录）
    const [historyResult, countResult] = await Promise.all([
      query(
        `SELECT id, title, url, thumbnail_url, width, height, tags, category, created_at
         FROM images 
         WHERE description LIKE '%[crawl]%'
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM images WHERE description LIKE '%[crawl]%'`
      ),
    ]);

    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({
      sources: CRAWL_SOURCES,
      history: historyResult,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      crawlLogs: logResult,
      crawlLogsTotal: (logCountResult as any[])[0]?.total || 0,
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

    // 参数验证：支持两种模式
    // 1. 自定义URL模式 (url 字段)
    // 2. 固定源模式 (source 字段)
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
      // 验证URL格式
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
    const crawlPages = Math.min(Math.max(parseInt(pages) || 1, 1), 10); // 最多10页
    const enableDedup = dedup !== false; // 默认开启去重
    const categoryValue = category || ""; // 手动指定分类
    const tagsValue = tags || ""; // 手动指定标签（逗号分隔）

    // 创建爬取历史记录
    const crawlSource = isUrlMode ? url : source;
    const crawlModeStr = isUrlMode ? (fetchMode || "auto") : (mode || "random");
    const tagsStr = Array.isArray(tagsValue) ? tagsValue.join(",") : tagsValue;

    const logResult = await query(
      `INSERT INTO crawl_logs (source, source_url, crawl_mode, category, tags, pages, requested_count, status, operator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?)`,
      [
        isUrlMode ? new URL(url).hostname : source,
        isUrlMode ? url : (CRAWL_SOURCES.find(s => s.id === source)?.url || ""),
        crawlModeStr,
        categoryValue,
        tagsStr,
        crawlPages,
        crawlCount,
        userId,
      ]
    );
    const crawlLogId = (logResult as any).insertId;
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
      // 更新爬取历史为失败
      const duration = Math.round((Date.now() - startTime) / 1000);
      await query(
        `UPDATE crawl_logs SET status = 'failed', error_message = ?, finished_at = NOW(), duration_seconds = ? WHERE id = ?`,
        [crawlResult.error || "爬取未返回任何结果", duration, crawlLogId]
      );
      return NextResponse.json(
        {
          error: crawlResult.error || "爬取未返回任何结果",
          success: false,
        },
        { status: 500 }
      );
    }

    // 创建预览会话 — 不再直接入库，先写入临时预览表供用户选择
    const sessionResult = await query(
      `INSERT INTO crawl_sessions (source_url, source_type, category, tags, crawl_log_id, total_count, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        isUrlMode ? url : (CRAWL_SOURCES.find(s => s.id === source)?.url || ""),
        isUrlMode ? "custom" : source,
        categoryValue,
        tagsStr,
        crawlLogId,
        crawlResult.results.length,
      ]
    );
    const sessionId = (sessionResult as any).insertId;

    // 批量写入预览项
    if (crawlResult.results.length > 0) {
      const insertValues: string[] = [];
      const insertParams: any[] = [];
      for (const item of crawlResult.results) {
        const isVideo = item.media_type === "video";
        insertValues.push("(?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)");
        insertParams.push(
          sessionId,
          isVideo ? (item.video_url || item.image_url) : (item.image_url || ""),
          item.title || "",
          item.width || 0,
          item.height || 0,
          item.file_size || 0,
          item.mime_type || (isVideo ? "video/mp4" : "image/jpeg"),
          isVideo ? "video" : "image",
          item.source || (isUrlMode ? new URL(url).hostname : source),
          Array.isArray(item.tags) ? item.tags.join(",") : (item.tags || ""),
          item.category || categoryValue,
          isVideo ? (item.video_url || null) : null,
          isVideo ? (item.poster_url || null) : null
        );
      }
      await query(
        `INSERT INTO crawl_preview_items (session_id, source_url, title, width, height, file_size, mime_type, media_type, is_selected, source, tags, category, video_url, poster_url)
         VALUES ${insertValues.join(", ")}`,
        insertParams
      );
    }

    // 更新爬取历史为完成
    const duration = Math.round((Date.now() - startTime) / 1000);
    await query(
      `UPDATE crawl_logs SET status = 'completed', success_count = ?, finished_at = NOW(), duration_seconds = ? WHERE id = ?`,
      [crawlResult.results.length, duration, crawlLogId]
    );

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

    // 根据模式选择 --url 或 --source
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

    // 分页参数
    if (params.pages && params.pages > 1) {
      args.push("--pages", String(params.pages));
    }

    // 去重参数
    if (params.dedup === false) {
      args.push("--no-dedup");
    }

    // 手动分类参数
    if (params.category) {
      args.push("--category", params.category);
    }

    // 手动标签参数
    if (params.tags) {
      args.push("--tags", params.tags);
    }

    // 尝试找到 Python 可执行文件
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    const proc = spawn(pythonCmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      timeout: 120000, // 2分钟超时
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
        // 解析 JSON 输出
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
  // 视频类型优先使用 video_url（实际视频文件地址），image_url 可能是封面图
  const downloadUrl = (isVideo && item.video_url) ? item.video_url : item.image_url;

  if (!downloadUrl) return null;

  // 1. 下载图片/视频
  const imageRes = await fetch(downloadUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": new URL(item.image_url).origin + "/",
    },
    signal: AbortSignal.timeout(60000), // 视频文件较大，超时60秒
  });

  if (!imageRes.ok) {
    console.error(`下载失败: HTTP ${imageRes.status} - ${item.image_url}`);
    return null;
  }

  const contentType = imageRes.headers.get("content-type") || (isVideo ? "video/mp4" : "image/jpeg");
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // 2. 获取图片尺寸（视频不处理）
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

  // 3. 上传文件到 MinIO
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

  // 4. 生成缩略图（视频用 poster，静态图片正常生成）
  let thumbnailUrl = "";
  let posterStoredUrl = "";

  if (isVideo) {
    // 视频类型：使用爬取到的 poster_url 或存储视频URL
    posterStoredUrl = storedUrl; // 视频文件URL
    if (item.poster_url) {
      // 尝试下载封面图作为缩略图
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
    // 静态图片：正常生成缩略图
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

  // 5. 提取颜色（仅静态图片）
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

  // 6. 写入数据库（增加 media_type, video_url, poster_url 字段）
  const tagsStr = Array.isArray(item.tags) ? item.tags.join(",") : (item.tags || "");
  const description = `[crawl] 从 ${item.source} 爬取 | 源地址: ${item.source_url || item.image_url}${isVideo ? " | 动态壁纸" : ""}`;

  const result = await query(
    `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category, status, dominant_color, color_palette, uploaded_by, media_type, video_url, poster_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title || `从${item.source}爬取的${isVideo ? "动态壁纸" : "图片"}`,
      description,
      safeName,
      storageKey,
      isVideo ? (thumbnailUrl || storedUrl) : storedUrl, // 视频的url显示封面/缩略图
      thumbnailUrl || null,
      width,
      height,
      imageBuffer.length,
      contentType,
      `crawler-${item.source}`,
      tagsStr,
      item.category || "",
      "approved",
      dominantColor,
      colorPalette,
      userId,
      isVideo ? "video" : "image",
      isVideo ? storedUrl : null,     // video_url: 视频文件地址
      isVideo ? (thumbnailUrl || null) : null, // poster_url: 封面图地址
    ]
  );

  const insertId = (result as any).insertId;

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