# 爬虫预览选择入库 — 设计规格

**日期**：2026-06-02  
**状态**：已确认

---

## 一、问题描述

当前爬虫（`src/app/api/admin/crawl/route.ts`）爬取完成后，自动下载所有图片 → 上传 MinIO → 直接以 `status='approved'` 写入 `images` 表。用户无法筛选，导致 logo、小程序码、表情包等非预期图片也被入库。

## 二、核心方案

**先预览再入库**：爬虫只负责解析 URL 和元数据，存入临时表。用户在预览界面勾选需要的图片后，仅下载和入库选中的内容。

## 三、数据库变更

### 3.1 新表 `crawl_sessions`

用于跟踪每次爬取任务会话。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 主键 |
| source_url | VARCHAR(2048) | 爬取来源 URL |
| source_type | VARCHAR(64) | 固定源名称（如 wallhaven） |
| category | VARCHAR(64) | 分类 |
| tags | VARCHAR(512) | 标签 |
| total_count | INT | 爬取到的图片总数 |
| selected_count | INT | 用户选中的数量 |
| imported_count | INT | 成功入库的数量 |
| status | ENUM('pending','importing','completed','discarded') | 状态 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 3.2 新表 `crawl_preview_items`

用于存储待选择的预览项。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT AUTO_INCREMENT PK | 主键 |
| session_id | INT FK → crawl_sessions.id | 关联会话 |
| source_url | TEXT | 原始图片/视频 URL |
| title | VARCHAR(512) | 图片标题 |
| width | INT | 宽度（像素） |
| height | INT | 高度（像素） |
| file_size | BIGINT | 文件大小（字节） |
| mime_type | VARCHAR(64) | MIME 类型 |
| media_type | ENUM('image','video') | 媒体类型 |
| is_selected | TINYINT(1) DEFAULT 0 | 是否被用户选中 |
| created_at | DATETIME | 创建时间 |

### 3.3 迁移脚本

创建 SQL 迁移文件 `scripts/migrate_crawl_preview.sql`。

## 四、API 变更

### 4.1 爬取阶段 — 修改 `POST /api/admin/crawl`

**变更**：原有"爬取+下载+入库"全流程改为"爬取+写入预览表"。

流程：
1. Python 脚本返回爬取结果 JSON
2. 创建 `crawl_sessions` 记录（status='pending'）
3. 批量 INSERT 到 `crawl_preview_items`（is_selected=0）
4. 返回 `{ session_id, total_count }` 给前端
5. 不再调用 `processCrawledImage()`（下载/上传/入库）

### 4.2 新增 `GET /api/admin/crawl/preview?session_id=&page=&pageSize=`

分页返回待选择预览项列表。

响应：
```json
{
  "session": { "id": 1, "status": "pending", "total_count": 50, ... },
  "items": [{ "id": 1, "source_url": "...", "title": "...", ... }],
  "pagination": { "page": 1, "pageSize": 20, "total": 50 }
}
```

### 4.3 新增 `PATCH /api/admin/crawl/preview/select`

批量标记选中/取消选中。

请求体：
```json
{
  "session_id": 1,
  "item_ids": [1, 3, 5],
  "selected": true  // true=选中, false=取消
}
```

### 4.4 新增 `POST /api/admin/crawl/import`

确认入库。仅处理 `is_selected=1` 且 `session_id` 匹配的项。

流程：
1. 查询 `crawl_preview_items WHERE session_id=? AND is_selected=1`
2. 更新 `crawl_sessions` 状态为 'importing'
3. 逐条下载 → 上传 MinIO → INSERT images
4. 更新 `crawl_sessions` 状态为 'completed'，记录 `imported_count`
5. 通过 SSE 推送进度

### 4.5 新增 `DELETE /api/admin/crawl/preview?session_id=`

丢弃整个会话的未入库预览数据（级联删除 items）。

## 五、前端变更

### 5.1 新建组件 `src/app/admin/CrawlPreview.tsx`

爬虫预览选择界面：

```
┌──────────────────────────────────────────────┐
│ [全选] [取消全选]  已选 12/50张  [确认入库] [丢弃] │
├──────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │ ☑️  │ │ ☐  │ │ ☑️  │ │ ☐  │ │ ☑️  │   │
│ │ img │ │ img │ │ img │ │ img │ │ img │   │
│ │1920x│ │1600x│ │4K   │ │800x │ │2K   │   │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
│ ...                                         │
├──────────────────────────────────────────────┤
│              < 1 2 3 ... 10 >               │
└──────────────────────────────────────────────┘
```

功能：
- 网格布局，每张图片显示缩略图 + 标题 + 分辨率 + 勾选框
- 视频项标记 LIVE badge
- 点击图片可放大预览
- 全选/取消全选/反选
- 分页
- 确认入库时显示进度条（SSE 实时推送）

### 5.2 修改 `CrawlTab.tsx`

爬取完成后不再显示"已入库 N 张"，而是：
- 显示"爬取完成，共 N 张图片，请选择后入库"
- 提供"前往预览"按钮跳转到 CrawlPreview

### 5.3 路由调整

`AdminClient.tsx` 中新增 `CrawlPreview` 的路由注册。

## 六、存量影响

| 组件 | 影响 |
|------|------|
| `crawl/route.ts` | 核心重写：去掉入库逻辑，新增写预览表逻辑 |
| `crawl/route.ts` 的 `processCrawledImage()` | 移动到 import API 中复用 |
| `crawl/review/route.ts` | 保留但后续可移除（新流程无需 pending 审核） |
| `crawl/events/route.ts` | 保持不变，SSE 继续推送进度 |
| `crawl/schedule/route.ts` | 保持不变 |
| `crawl_logs` 表 | 保留，记录历史任务元数据 |
| `images` 表 | 不变 |

## 七、自检

- [x] 无 TODO / 占位符
- [x] 各章节相互一致（表结构 ↔ API ↔ 前端组件）
- [x] 范围聚焦：仅涉及爬虫预览选择入库一个需求
- [x] 无模糊表述：所有字段类型、API 路径、请求/响应格式已明确
