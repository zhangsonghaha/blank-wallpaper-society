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

    // 查询爬取历史（从 images 表中筛选 source 为爬虫导入的记录）
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
    const { source, mode, count, url, fetchMode, minWidth } = body;

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

    // 调用 Python 爬虫脚本
    const scriptPath = path.join(process.cwd(), "scripts", "crawl_with_scrapling.py");
    const crawlResult = await runCrawlScript(scriptPath, {
      url: isUrlMode ? url : undefined,
      source: isSourceMode ? source : undefined,
      mode: mode || "random",
      fetchMode: fetchMode || "auto",
      count: crawlCount,
      minWidth: parseInt(minWidth) || 800,
    });

    if (!crawlResult.success || !crawlResult.results || crawlResult.results.length === 0) {
      return NextResponse.json(
        {
          error: crawlResult.error || "爬取未返回任何结果",
          success: false,
        },
        { status: 500 }
      );
    }

    // 处理爬取结果：下载图片 -> 上传 MinIO -> 写入数据库
    const processedResults = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of crawlResult.results) {
      try {
        const result = await processCrawledImage(item, userId);
        if (result) {
          processedResults.push(result);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error: any) {
        console.error(`处理爬取图片失败 [${item.title}]:`, error);
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `爬取完成: 成功 ${successCount} 张, 失败 ${failCount} 张`,
      total: crawlResult.results.length,
      successCount,
      failCount,
      results: processedResults,
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

    // 尝试找到 Python 可执行文件
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    const proc = spawn(pythonCmd, args, {
      cwd: process.cwd(),
      env: { ...process.env },
      timeout: 120000, // 2分钟超时
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
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
  },
  userId: number
): Promise<any | null> {
  if (!item.image_url) return null;

  // 1. 下载图片
  const imageRes = await fetch(item.image_url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!imageRes.ok) {
    console.error(`下载图片失败: HTTP ${imageRes.status} - ${item.image_url}`);
    return null;
  }

  const contentType = imageRes.headers.get("content-type") || "image/jpeg";
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // 2. 获取图片尺寸
  let width = item.width || 0;
  let height = item.height || 0;
  try {
    const metadata = await sharp(imageBuffer).metadata();
    width = metadata.width || width;
    height = metadata.height || height;
  } catch {
    // sharp 无法解析时使用爬取到的尺寸
  }

  // 3. 上传原图到 MinIO
  const timestamp = Date.now();
  const safeName = item.filename || `crawled_${timestamp}.jpg`;
  const storageKey = `images/${timestamp}_${safeName}`;

  const minioClient = await import("@/lib/minio").then((m) => m.getMinioClient());
  await minioClient.putObject(BUCKET_NAME, storageKey, imageBuffer, imageBuffer.length, {
    "Content-Type": contentType,
  });

  const storedUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

  // 4. 生成缩略图
  let thumbnailUrl = "";
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

  // 5. 提取颜色
  let dominantColor: string | null = null;
  let colorPalette: string | null = null;
  try {
    const colors = await extractColors(imageBuffer);
    dominantColor = colors.dominant;
    colorPalette = JSON.stringify(colors.palette);
  } catch {
    // 颜色提取失败不影响主流程
  }

  // 6. 写入数据库
  const tagsStr = Array.isArray(item.tags) ? item.tags.join(",") : (item.tags || "");
  const description = `[crawl] 从 ${item.source} 爬取 | 源地址: ${item.source_url || item.image_url}`;

  const result = await query(
    `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category, status, dominant_color, color_palette, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title || "爬取壁纸",
      description,
      safeName,
      storageKey,
      storedUrl,
      thumbnailUrl || null,
      width,
      height,
      imageBuffer.length,
      contentType,
      `crawler-${item.source}`,
      tagsStr,
      item.category || "",
      "approved", // 管理员爬取直接通过审核
      dominantColor,
      colorPalette,
      userId,
    ]
  );

  const insertId = (result as any).insertId;

  return {
    id: insertId,
    title: item.title || "爬取壁纸",
    url: storedUrl,
    thumbnail_url: thumbnailUrl,
    width,
    height,
    tags: tagsStr,
    category: item.category,
    source: item.source,
  };
}