# 爬虫预览选择入库 — 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 爬虫爬取后不再直接入库，而是存入临时预览表，用户在 CrawlPreview 界面勾选需要的图片后，只下载和入库选中的内容。

**架构：** 新增 `crawl_sessions` + `crawl_preview_items` 两张表存储爬取会话和预览项。重写 `POST /api/admin/crawl` 去除入库逻辑，改写入预览表。新增 import API 复现有 `processCrawledImage()` 下载上传入库流程。新建 `CrawlPreview` 前端组件展示勾选界面。

**技术栈：** Next.js 15 App Router, TypeScript, React, MySQL, MinIO, sharp, Tailwind CSS

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `scripts/migrate_crawl_preview.sql` | 新建 | SQL 建表迁移脚本 |
| `src/app/api/admin/crawl/route.ts` | 修改 | POST 重写为写入预览表；GET 增加 pending sessions 返回 |
| `src/app/api/admin/crawl/preview/route.ts` | 新建 | GET 分页返回预览项；PATCH 批量选中/取消；DELETE 丢弃会话 |
| `src/app/api/admin/crawl/import/route.ts` | 新建 | POST 下载选中项 → MinIO → images 表 |
| `src/app/admin/CrawlPreview.tsx` | 新建 | 预览选择前端组件（网格+勾选+分页+确认入库+进度） |
| `src/app/admin/CrawlTab.tsx` | 修改 | 爬取完成后显示 session_id，提供"前往预览"按钮 |

---

### 任务 1：数据库迁移脚本

**文件：**
- 创建：`scripts/migrate_crawl_preview.sql`

- [ ] **步骤 1：创建迁移 SQL 文件**

```sql
-- 爬虫预览选择入库 - 新建预览表
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_crawl_preview.sql

-- 爬取会话表
CREATE TABLE IF NOT EXISTS crawl_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_url VARCHAR(2048) DEFAULT NULL COMMENT '爬取来源URL',
  source_type VARCHAR(64) DEFAULT NULL COMMENT '固定源名称（wallhaven等）',
  category VARCHAR(64) DEFAULT NULL COMMENT '分类',
  tags VARCHAR(512) DEFAULT NULL COMMENT '标签',
  crawl_log_id INT DEFAULT NULL COMMENT '关联 crawl_logs 表',
  total_count INT DEFAULT 0 COMMENT '爬取到的图片总数',
  selected_count INT DEFAULT 0 COMMENT '用户选中的数量',
  imported_count INT DEFAULT 0 COMMENT '成功入库的数量',
  status ENUM('pending','importing','completed','discarded') DEFAULT 'pending' COMMENT '会话状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_crawl_log_id (crawl_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬虫预览会话表';

-- 预览项表
CREATE TABLE IF NOT EXISTS crawl_preview_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL COMMENT '关联 crawl_sessions.id',
  source_url TEXT COMMENT '原始图片/视频URL',
  title VARCHAR(512) DEFAULT NULL COMMENT '图片标题',
  width INT DEFAULT 0 COMMENT '宽度',
  height INT DEFAULT 0 COMMENT '高度',
  file_size BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  mime_type VARCHAR(64) DEFAULT NULL COMMENT 'MIME类型',
  media_type ENUM('image','video') DEFAULT 'image' COMMENT '媒体类型',
  is_selected TINYINT(1) DEFAULT 0 COMMENT '是否被用户选中',
  source VARCHAR(100) DEFAULT NULL COMMENT '爬取来源（如域名）',
  tags VARCHAR(500) DEFAULT NULL COMMENT '标签，逗号分隔',
  category VARCHAR(64) DEFAULT NULL COMMENT '分类',
  video_url TEXT DEFAULT NULL COMMENT '视频原始URL',
  poster_url TEXT DEFAULT NULL COMMENT '封面图URL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_selected (session_id, is_selected),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬虫预览项表';
```

- [ ] **步骤 2：执行迁移**

```bash
mysql -u zhangsong -p img < scripts/migrate_crawl_preview.sql
```

验证：
```sql
SHOW TABLES LIKE 'crawl_%';
DESC crawl_sessions;
DESC crawl_preview_items;
```

---

### 任务 2：修改 POST /api/admin/crawl — 爬取结果写入预览表

**文件：**
- 修改：`src/app/admin/CrawlTab.tsx:244-321`（前端 `startCrawl` 函数）
- 修改：`src/app/api/admin/crawl/route.ts:118-312`（POST 处理逻辑）

- [ ] **步骤 1：修改 CrawlTab.tsx — 爬取完成后跳转预览**

搜索 `startCrawl` 函数中 `setStatus("done")` 后的逻辑（约第306-312行），删除旧的`setResults()` 展示逻辑，改为存储 `session_id` 并提供"前往预览"入口。

在 `CrawlTab.tsx` 顶部新加 state：
```typescript
const [lastSessionId, setLastSessionId] = useState<number | null>(null);
```

修改 `startCrawl` 中成功回调（第296-321行替换为）：

```typescript
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus("error");
        setErrorMessage(data.error || "爬取失败");
        toast.error(data.error || "爬取失败");
        return;
      }

      setStatus("done");
      setResults([]); // 不再展示旧的结果列表
      const sessionId = data.session_id;
      setLastSessionId(sessionId);
      setProgressText(`爬取完成，共 ${data.total_count} 张图片，请选择后确认入库`);
      toast.success(data.message || `爬取完成，共 ${data.total_count} 张图片`);
      loadHistory();
```

**步骤 2：在 CrawlTab.tsx 结果区显示"前往预览"按钮**

找到结果区的 Card（约第798行 `{results.length > 0 && (`），改为检测 `lastSessionId`：

```tsx
{lastSessionId && status === "done" && (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        爬取完成
      </CardTitle>
      <CardDescription>{progressText}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button onClick={() => setActiveTab && setActiveTab("crawl-preview")}>
        <Eye className="w-4 h-4 mr-2" />
        前往预览选择
      </Button>
    </CardContent>
  </Card>
)}
```

同时在文件顶部补充导入 `Eye`：

```typescript
import { ..., Eye } from "lucide-react";
```

注意：`CrawlTab` 本身没有 `setActiveTab`，需要通过事件 `window.dispatchEvent(new CustomEvent("admin:navigate", { detail: "crawl-preview" }))` 或者通过 props 传入。CrawlTab 目前没有 props。最简单的办法是使用 `admin:navigate` 事件，配合在跳转时传递 `session_id`。

修改为事件驱动方式，需要把 `lastSessionId` 存到全局可访问的地方。最简单：通过 URL searchParams 传参。或者用事件：

```typescript
// 替换 setActiveTab 调用
window.dispatchEvent(new CustomEvent("admin:navigate", { 
  detail: `crawl-preview?session=${sessionId}` 
}));
```

或者更简单的方式：在预览组件里从后端获取最新的 pending session。后端 GET /api/admin/crawl/preview 增加一个参数 `action=sessions` 返回未完成的 session 列表。CrawlPreview 组件自动加载最近一个 pending session。

实际采用方案：CrawlPreview 组件挂载时自动 fetch 最新 pending session。

修改 CrawlTab 上的按钮为：

```tsx
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

// 在结果区的 Button 中：
<Button onClick={() => {
  window.dispatchEvent(new CustomEvent("admin:navigate", { 
    detail: "crawl-preview" 
  }));
}}>
  <Eye className="w-4 h-4 mr-2" />
  前往预览选择
</Button>
```

**步骤 3：修改 route.ts — POST 重写为写入预览表**

将 `POST` 处理函数中第257-298行的"处理爬取结果"循环和"更新爬取历史"逻辑全部替换。核心改动：不再调用 `processCrawledImage()`，改为写 `crawl_sessions` + `crawl_preview_items`。

替换第257-308行：

```typescript
    // 创建预览会话
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
        insertValues.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        insertParams.push(
          sessionId,
          isVideo ? (item.video_url || item.image_url) : (item.image_url || ""),
          item.title || "",
          item.width || 0,
          item.height || 0,
          item.file_size || 0,
          item.mime_type || (isVideo ? "video/mp4" : "image/jpeg"),
          isVideo ? "video" : "image",
          0, // is_selected = 0
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

    // 更新 crawl_logs 为完成
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
```

同时删除 `dedupSkipped` 和 `existingUrls`、`successCount`、`failCount`、`processedResults` 相关变量（第229-255行和第258-281行的整体替换覆盖了它们）。

**步骤 4：保留 processCrawledImage 函数不动**

`processCrawledImage()` 函数（第438-611行）保持不变，后续由 import API 调用。

---

### 任务 3：新建预览 API

**文件：**
- 创建：`src/app/api/admin/crawl/preview/route.ts`

- [ ] **步骤 1：创建 GET（获取预览列表）+ PATCH（选中/取消）+ DELETE（丢弃会话）**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/admin/crawl/preview — 获取会话信息 + 分页预览项
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const offset = (page - 1) * pageSize;

    let targetSessionId = sessionId ? parseInt(sessionId) : null;

    // 未指定 session_id 时，自动获取最近一个 pending 会话
    if (!targetSessionId) {
      const latestSessions = await query(
        `SELECT id FROM crawl_sessions WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1`
      ) as any[];
      if (latestSessions.length > 0) {
        targetSessionId = latestSessions[0].id;
      }
    }

    if (!targetSessionId) {
      return NextResponse.json({
        session: null,
        items: [],
        pagination: { page: 1, pageSize, total: 0 },
      });
    }

    const sessionRows = await query(
      `SELECT id, source_url, source_type, category, tags, total_count, selected_count, imported_count, status, created_at
       FROM crawl_sessions WHERE id = ?`,
      [targetSessionId]
    ) as any[];

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const [items, countResult] = await Promise.all([
      query(
        `SELECT id, session_id, source_url, title, width, height, file_size, mime_type, media_type, is_selected, source, tags, category, video_url, poster_url, created_at
         FROM crawl_preview_items
         WHERE session_id = ?
         ORDER BY id ASC
         LIMIT ? OFFSET ?`,
        [targetSessionId, pageSize, offset]
      ),
      query(
        `SELECT COUNT(*) as total FROM crawl_preview_items WHERE session_id = ?`,
        [targetSessionId]
      ),
    ]);

    const total = (countResult as any[])[0]?.total || 0;

    return NextResponse.json({
      session: sessionRows[0],
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error("GET /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/crawl/preview — 批量选中/取消选中
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await request.json();
    const { session_id, item_ids, selected, select_all } = body;

    if (!session_id) {
      return NextResponse.json({ error: "请提供 session_id" }, { status: 400 });
    }

    if (select_all !== undefined) {
      // 全选/取消全选
      await query(
        `UPDATE crawl_preview_items SET is_selected = ? WHERE session_id = ?`,
        [select_all ? 1 : 0, session_id]
      );
      const countResult = await query(
        `SELECT COUNT(*) as cnt FROM crawl_preview_items WHERE session_id = ? AND is_selected = 1`,
        [session_id]
      ) as any[];
      const selectedCount = (countResult[0] as any)?.cnt || 0;
      await query(
        `UPDATE crawl_sessions SET selected_count = ? WHERE id = ?`,
        [selectedCount, session_id]
      );
      return NextResponse.json({ message: select_all ? "已全选" : "已取消全选", selected_count: selectedCount });
    }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: "请提供 item_ids" }, { status: 400 });
    }

    const placeholders = item_ids.map(() => "?").join(",");
    await query(
      `UPDATE crawl_preview_items SET is_selected = ? WHERE id IN (${placeholders}) AND session_id = ?`,
      [selected ? 1 : 0, ...item_ids, session_id]
    );

    // 更新 session 的 selected_count
    const countResult = await query(
      `SELECT COUNT(*) as cnt FROM crawl_preview_items WHERE session_id = ? AND is_selected = 1`,
      [session_id]
    ) as any[];
    const selectedCount = (countResult[0] as any)?.cnt || 0;
    await query(
      `UPDATE crawl_sessions SET selected_count = ? WHERE id = ?`,
      [selectedCount, session_id]
    );

    return NextResponse.json({
      message: selected ? "已选中" : "已取消选中",
      selected_count: selectedCount,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/crawl/preview — 丢弃会话（级联删除预览项）
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = parseInt(searchParams.get("session_id") || "0");

    if (!sessionId) {
      return NextResponse.json({ error: "请提供 session_id" }, { status: 400 });
    }

    // 级联删除
    await query(`DELETE FROM crawl_preview_items WHERE session_id = ?`, [sessionId]);
    await query(`UPDATE crawl_sessions SET status = 'discarded' WHERE id = ?`, [sessionId]);

    return NextResponse.json({ message: "会话已丢弃" });
  } catch (error: any) {
    console.error("DELETE /api/admin/crawl/preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### 任务 4：新建导入 API（下载 → MinIO → images）

**文件：**
- 创建：`src/app/api/admin/crawl/import/route.ts`

- [ ] **步骤 1：创建 POST /api/admin/crawl/import**

将 `crawl/route.ts` 中的 `processCrawledImage()` 函数复制到此文件，并新增批量导入逻辑。函数需要转为从 `crawl_preview_items` 字段映射到 `processCrawledImage` 参数格式。

```typescript
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadFile, BUCKET_NAME, PUBLIC_URL_BASE, getMinioClient } from "@/lib/minio";
import { extractColors } from "@/lib/color-extract";
import { indexImage, dbRowToSearchData } from "@/lib/meilisearch";
import sharp from "sharp";

// POST /api/admin/crawl/import — 确认入库选中的预览项
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const userId = (session.user as any).id;
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: "请提供 session_id" }, { status: 400 });
    }

    // 获取选中的预览项
    const items = await query(
      `SELECT * FROM crawl_preview_items WHERE session_id = ? AND is_selected = 1`,
      [session_id]
    ) as any[];

    if (items.length === 0) {
      return NextResponse.json({ error: "没有选中的图片" }, { status: 400 });
    }

    // 更新会话状态为 importing
    await query(
      `UPDATE crawl_sessions SET status = 'importing' WHERE id = ?`,
      [session_id]
    );

    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        const result = await processPreviewItem(item, userId);
        if (result) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error: any) {
        console.error(`导入失败 [${item.title}]:`, error);
        failCount++;
      }
    }

    // 更新会话状态为 completed
    await query(
      `UPDATE crawl_sessions SET status = 'completed', imported_count = ? WHERE id = ?`,
      [successCount, session_id]
    );

    return NextResponse.json({
      success: true,
      message: `入库完成: 成功 ${successCount} 张, 失败 ${failCount} 张`,
      success_count: successCount,
      fail_count: failCount,
    });
  } catch (error: any) {
    console.error("POST /api/admin/crawl/import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 处理单条预览项：下载 → 上传 MinIO → 写入 images 表
async function processPreviewItem(
  item: {
    id: number;
    source_url: string;
    title: string;
    width: number;
    height: number;
    mime_type: string;
    media_type: string;
    source: string;
    tags: string;
    category: string;
    video_url: string | null;
    poster_url: string | null;
  },
  userId: number
): Promise<any | null> {
  const isVideo = item.media_type === "video";
  const downloadUrl = (isVideo && item.video_url) ? item.video_url : item.source_url;

  if (!downloadUrl) return null;

  // 1. 下载
  const imageRes = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": isVideo ? "" : new URL(item.source_url).origin + "/",
    },
    signal: AbortSignal.timeout(60000),
  });

  if (!imageRes.ok) {
    console.error(`下载失败: HTTP ${imageRes.status} - ${downloadUrl}`);
    return null;
  }

  const contentType = imageRes.headers.get("content-type") || (isVideo ? "video/mp4" : "image/jpeg");
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  // 2. 获取尺寸
  let width = item.width || 0;
  let height = item.height || 0;
  if (!isVideo) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      width = metadata.width || width;
      height = metadata.height || height;
    } catch { /* ignore */ }
  }

  // 3. 上传 MinIO
  const timestamp = Date.now();
  const safeName = isVideo ? `crawled_${timestamp}.mp4` : `crawled_${timestamp}.jpg`;
  const storageKey = isVideo
    ? `videos/${timestamp}_${safeName}`
    : `images/${timestamp}_${safeName}`;

  const minioClient = getMinioClient();
  await minioClient.putObject(BUCKET_NAME, storageKey, imageBuffer, imageBuffer.length, {
    "Content-Type": contentType,
  });

  const storedUrl = `${PUBLIC_URL_BASE}/${BUCKET_NAME}/${storageKey}`;

  // 4. 生成缩略图
  let thumbnailUrl = "";
  if (isVideo && item.poster_url) {
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
    } catch { /* ignore */ }
  } else {
    try {
      const thumbBuffer = await sharp(imageBuffer)
        .resize(400, 400, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const thumbResult = await uploadFile(thumbBuffer, `thumb_${timestamp}.webp`, "image/webp");
      thumbnailUrl = thumbResult.url;
    } catch { /* ignore */ }
  }

  // 5. 提取颜色
  let dominantColor: string | null = null;
  let colorPalette: string | null = null;
  if (!isVideo) {
    try {
      const colors = await extractColors(imageBuffer);
      dominantColor = colors.dominant;
      colorPalette = JSON.stringify(colors.palette);
    } catch { /* ignore */ }
  }

  // 6. 写入 images 表
  const tagsStr = item.tags || "";
  const description = `[crawl] 从 ${item.source} 爬取 | 源地址: ${item.source_url}${isVideo ? " | 动态壁纸" : ""}`;

  const result = await query(
    `INSERT INTO images (title, description, filename, storage_key, url, thumbnail_url, width, height, file_size, mime_type, author, tags, category, status, dominant_color, color_palette, uploaded_by, media_type, video_url, poster_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.title || `从${item.source}爬取的${isVideo ? "动态壁纸" : "图片"}`,
      description,
      safeName,
      storageKey,
      isVideo ? (thumbnailUrl || storedUrl) : storedUrl,
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
      isVideo ? storedUrl : null,
      isVideo ? (thumbnailUrl || null) : null,
    ]
  );

  const insertId = (result as any).insertId;

  // 7. 同步搜索索引
  try {
    const insertedRows = await query(`SELECT * FROM images WHERE id = ?`, [insertId]) as any[];
    if (insertedRows.length > 0) {
      indexImage(dbRowToSearchData(insertedRows[0])).catch(() => {});
    }
  } catch { /* ignore */ }

  return {
    id: insertId,
    title: item.title,
    url: isVideo ? (thumbnailUrl || storedUrl) : storedUrl,
    thumbnail_url: thumbnailUrl,
    width,
    height,
    media_type: isVideo ? "video" : "image",
  };
}
```

---

### 任务 5：新建前端组件 CrawlPreview

**文件：**
- 创建：`src/app/admin/CrawlPreview.tsx`

- [ ] **步骤 1：创建 CrawlPreview 组件**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Eye,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Video,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// 类型定义
// ============================================================

interface CrawlSession {
  id: number;
  source_url: string;
  source_type: string;
  category: string;
  tags: string;
  total_count: number;
  selected_count: number;
  imported_count: number;
  status: string;
  created_at: string;
}

interface PreviewItem {
  id: number;
  session_id: number;
  source_url: string;
  title: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  media_type: "image" | "video";
  is_selected: number;
  source: string;
  tags: string;
  category: string;
  video_url: string | null;
  poster_url: string | null;
  created_at: string;
}

type ImportStatus = "idle" | "importing" | "done" | "error";

// ============================================================
// 缩略图预览组件（处理视频/图片加载失败）
// ============================================================

function ItemThumbnail({ item }: { item: PreviewItem }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        {item.media_type === "video" ? (
          <Video className="w-8 h-8 text-muted-foreground" />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
    );
  }

  if (item.media_type === "video") {
    return (
      <div className="relative w-full h-full">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Video className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <span className="absolute top-1 right-1 text-[9px] font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-1.5 py-0.5 rounded">
          LIVE
        </span>
      </div>
    );
  }

  return (
    <img
      src={item.source_url}
      alt={item.title}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

// ============================================================
// 主组件
// ============================================================

export default function CrawlPreview() {
  const [session, setSession] = useState<CrawlSession | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importProgress, setImportProgress] = useState("");
  const [noSession, setNoSession] = useState(false);

  const pageSize = 20;

  // ==================== 加载数据 ====================

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crawl/preview?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      if (!data.session) {
        setNoSession(true);
        setSession(null);
        setItems([]);
      } else {
        setNoSession(false);
        setSession(data.session);
        setItems(data.items || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      toast.error("加载预览数据失败");
      setNoSession(true);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // ==================== 选中/取消 ====================

  const toggleSelect = async (itemId: number, currentSelected: number) => {
    const csrfHeaders = await withCsrfHeader();
    const newSelected = currentSelected ? 0 : 1;
    
    // Optimistic update
    setItems(prev =>
      prev.map(it => it.id === itemId ? { ...it, is_selected: newSelected } : it)
    );
    setSession(prev =>
      prev ? { ...prev, selected_count: prev.selected_count + (newSelected ? 1 : -1) } : prev
    );

    try {
      await fetch("/api/admin/crawl/preview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          session_id: session?.id,
          item_ids: [itemId],
          selected: !!newSelected,
        }),
      });
    } catch {
      toast.error("操作失败");
      loadPreview();
    }
  };

  const selectAll = async () => {
    const csrfHeaders = await withCsrfHeader();
    const allSelected = items.every(it => it.is_selected);
    
    // Optimistic
    const newVal = allSelected ? 0 : 1;
    setItems(prev => prev.map(it => ({ ...it, is_selected: newVal })));
    setSession(prev =>
      prev ? { ...prev, selected_count: newVal ? prev.total_count : 0 } : prev
    );

    try {
      await fetch("/api/admin/crawl/preview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          session_id: session?.id,
          select_all: !allSelected,
        }),
      });
    } catch {
      toast.error("操作失败");
      loadPreview();
    }
  };

  // ==================== 确认入库 ====================

  const confirmImport = async () => {
    if (!session || session.selected_count === 0) {
      toast.error("请至少选择一张图片");
      return;
    }

    setImportStatus("importing");
    setImportProgress("正在下载并入库选中的内容...");

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/crawl/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ session_id: session.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImportStatus("error");
        setImportProgress(data.error || "入库失败");
        toast.error(data.error || "入库失败");
        return;
      }

      setImportStatus("done");
      setImportProgress(data.message);
      toast.success(data.message);
      loadPreview(); // 刷新状态
    } catch (err: any) {
      setImportStatus("error");
      setImportProgress(err.message || "请求失败");
      toast.error("入库请求失败");
    }
  };

  // ==================== 丢弃会话 ====================

  const discardSession = async () => {
    if (!session) return;
    if (!confirm(`确定要丢弃此会话的全部 ${session.total_count} 张图片吗？此操作不可撤销。`)) return;

    try {
      const csrfHeaders = await withCsrfHeader();
      await fetch(`/api/admin/crawl/preview?session_id=${session.id}`, {
        method: "DELETE",
        headers: csrfHeaders,
      });
      toast.success("会话已丢弃");
      setNoSession(true);
      setSession(null);
      setItems([]);
    } catch {
      toast.error("丢弃失败");
    }
  };

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-lg border overflow-hidden bg-muted/30">
                  <Skeleton className="aspect-[4/3]" />
                  <div className="p-2 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (noSession || !session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            爬虫预览选择
          </CardTitle>
          <CardDescription>没有待选择的爬取结果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">暂无待选择的爬取图片</p>
            <p className="text-xs mt-1">请先进行爬取操作</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allSelected = items.length > 0 && items.every(it => it.is_selected);
  const someSelected = items.some(it => it.is_selected);

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                选择要入库的图片
              </CardTitle>
              <CardDescription className="mt-1">
                来源：{session.source_type || "自定义URL"} | 
                共 {session.total_count} 张 | 
                已选 <span className="font-medium text-green-600">{session.selected_count}</span> 张
                {session.status === "completed" && (
                  <span className="ml-2 text-green-600 font-medium">（已完成入库 {session.imported_count} 张）</span>
                )}
              </CardDescription>
            </div>
            {importStatus !== "idle" && (
              <Badge className={
                importStatus === "importing" ? "bg-blue-100 text-blue-700" :
                importStatus === "done" ? "bg-green-100 text-green-700" :
                "bg-red-100 text-red-700"
              }>
                {importStatus === "importing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {importStatus === "done" && <CheckCircle className="w-3 h-3 mr-1" />}
                {importStatus === "error" && <AlertCircle className="w-3 h-3 mr-1" />}
                {importStatus === "importing" ? "入库中" : importStatus === "done" ? "完成" : "失败"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={importStatus === "importing" || session.status === "completed"}
            >
              {allSelected ? (
                <><Square className="w-4 h-4 mr-1.5" />取消全选</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-1.5" />全选</>
              )}
            </Button>
            <Button
              onClick={confirmImport}
              disabled={session.selected_count === 0 || importStatus === "importing" || session.status === "completed"}
              className="gap-1.5"
            >
              {importStatus === "importing" ? (
                <><Loader2 className="w-4 h-4 animate-spin" />入库中...</>
              ) : (
                <><Download className="w-4 h-4" />确认入库 ({session.selected_count}张)</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={discardSession}
              disabled={importStatus === "importing" || session.status === "completed"}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              丢弃全部
            </Button>
          </div>
          {importProgress && (
            <div className={`mt-3 text-sm ${importStatus === "error" ? "text-red-600" : "text-green-600"}`}>
              {importProgress}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 图片网格 */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const isSelected = !!item.is_selected;
              const disabled = importStatus === "importing" || session.status === "completed";
              return (
                <div
                  key={item.id}
                  onClick={() => !disabled && toggleSelect(item.id, item.is_selected)}
                  className={`group relative rounded-lg border-2 overflow-hidden bg-muted/30 cursor-pointer transition-all ${
                    disabled ? "cursor-not-allowed opacity-60" : ""
                  } ${
                    isSelected
                      ? "border-green-500 shadow-md shadow-green-500/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  {/* 缩略图 */}
                  <div className="aspect-[4/3] relative">
                    <ItemThumbnail item={item} />
                    {/* 选中覆盖层 */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-green-500/10 flex items-start justify-end p-1.5">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.category && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">{item.category}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {item.width}x{item.height}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <p className="text-xs text-muted-foreground">
                第 {page} 页 / 共 {totalPages} 页（{total} 张）
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 任务 6：注册 CrawlPreview 到 AdminClient

**文件：**
- 修改：`src/app/admin/AdminClient.tsx`

- [ ] **步骤 1：在 AdminClient.tsx 中注册 CrawlPreview**

添加导入（第44行附近）：
```typescript
import CrawlPreview from "./CrawlPreview";
```

在 `switchTab` 函数的 switch 语句中（第272行前）添加：
```typescript
      case "crawl-preview":
        content = <CrawlPreview />;
        break;
```

---

### 任务 7：清理 — 更新现有 CrawlReviewTab 逻辑

**文件：**
- 修改：`src/app/api/admin/crawl/route.ts`（移除 GET 中 `review` 相关查询）

无需改动，review 逻辑保持在独立的 `review/route.ts` 中，可独立使用。

---

## 自检

1. **规格覆盖度**：✔ 数据库变更（任务1）、API变更全部覆盖（任务2-4）、前端组件（任务5-6）、存量不影响
2. **占位符扫描**：✔ 所有代码块完整，无 TODO/占位符
3. **类型一致性**：✔ `PreviewItem` 接口与 `crawl_preview_items` 表字段一致，`CrawlSession` 与 `crawl_sessions` 一致
