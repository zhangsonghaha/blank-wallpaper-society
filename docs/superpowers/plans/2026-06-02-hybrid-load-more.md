# 混合滚动加载 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复首页 100 张上限 bug，三个图片展示页面统一改为「自动加载 3 页后手动加载更多」的混合滚动

**架构：** 首页 MasonryGrid 从客户端分片改为服务端分页（`page` + `limit=24`）；三个页面统一添加 `autoLoadedPages` 计数器，Observer 在计数 < 3 时自动触发，超过后断开并显示按钮

**技术栈：** Next.js App Router, React useState/useEffect/useCallback, IntersectionObserver, TypeScript

---

## 文件结构

| 文件 | 职责 | 改动程度 |
|------|------|----------|
| `src/components/MasonryGrid.tsx` | 首页瀑布流 — 新增服务端分页 + 混合滚动 | 大 |
| `src/app/collections/[id]/page.tsx` | 合集详情页 — 新增 autoLoadedPages 限制 + 按钮 | 小 |
| `src/app/theme-zone/[zoneKey]/page.tsx` | 专题详情页 — 新增 autoLoadedPages 限制 + 按钮 | 小 |

---

### 任务 1：MasonryGrid 首页 — 服务端分页 + 混合滚动

**文件：**
- 修改：`src/components/MasonryGrid.tsx`（主要改动区域）

**改动概要：**
1. 移除 `visibleCount` 和 `ITEMS_PER_PAGE`
2. 新增 `page`、`totalPages`、`autoLoadedPages` 状态
3. 重写图片加载 effect：使用 `page` + `limit=24` 请求 API
4. 新增 `fetchImages(pageNum, append)` 函数处理初始加载和追加
5. 重写 Observer：`autoLoadedPages < 3` 时自动加载
6. 重写 `loadMore` 回调：手动翻页
7. 移除 `displayedImages`/`filteredImages` 切片逻辑（直接显示全部 `images`）
8. 筛选变化时重置 page 和 autoLoadedPages

- [ ] **步骤 1：添加新状态，移除旧状态**

在组件顶部状态声明区域，替换：

```tsx
// 删除这行
const ITEMS_PER_PAGE = 12;

// 在组件内部，删除：
const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

// 新增（放在 images 状态之后、loading 之后）：
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [autoLoadedPages, setAutoLoadedPages] = useState(0);
```

文件 `src/components/MasonryGrid.tsx`，修改第 68 行和第 94 行附近。

- [ ] **步骤 2：重写图片加载 effect，改为服务端分页**

替换第 143-203 行的 `// 加载图片` useEffect，改为带分页的 fetchImages 函数 + effect：

```tsx
// 加载图片（带分页）
const fetchImages = useCallback(
  (pageNum: number, append: boolean) => {
    setIsLoadingMore(true);
    const controller = new AbortController();
    const params = new URLSearchParams();

    if (activeColor) {
      params.set("color", activeColor);
      params.set("threshold", String(colorThreshold));
    }

    if (activeCategory !== "all") params.set("category", activeCategory);
    if (searchQuery.trim()) params.set("search", searchQuery);
    if (sortBy) params.set("sort", sortBy);

    if (resolutionFilter.minWidth) params.set("minWidth", String(resolutionFilter.minWidth));
    if (resolutionFilter.maxWidth) params.set("maxWidth", String(resolutionFilter.maxWidth));
    if (resolutionFilter.minHeight) params.set("minHeight", String(resolutionFilter.minHeight));
    if (resolutionFilter.maxHeight) params.set("maxHeight", String(resolutionFilter.maxHeight));

    if (dateFilter.from) params.set("dateFrom", dateFilter.from);
    if (dateFilter.to) params.set("dateTo", dateFilter.to);

    params.set("page", String(pageNum));
    params.set("limit", "24");

    const apiUrl = activeColor ? `/api/images/search/color?${params}` : `/api/images?${params}`;

    fetch(apiUrl, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        const newData = data.data || [];
        if (append) {
          setImages((prev) => [...prev, ...newData]);
        } else {
          setImages(newData);
          if (!activeColor) {
            setSearchEngine(data._searchEngine || "");
            setRecommendations(data.recommendations || []);
          }
        }
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setLoading(false);
        setIsLoadingMore(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setLoading(false);
          setIsLoadingMore(false);
        }
      });

    return controller;
  },
  [activeCategory, searchQuery, activeColor, colorThreshold, sortBy, resolutionFilter, dateFilter]
);

// 筛选变化时重新加载第 1 页
useEffect(() => {
  setLoading(true);
  setPage(1);
  setAutoLoadedPages(0);
  const controller = fetchImages(1, false);
  return () => {
    if (controller) controller.abort();
  };
}, [activeCategory, searchQuery, activeColor, colorThreshold, sortBy, resolutionFilter, dateFilter]);
```

- [ ] **步骤 3：更新 hasMore 和筛选重置**

找到 `hasMore` 相关代码（原先在 `displayedImages` 计算附近，约第 276 行）和筛选回调中引用 `setVisibleCount` 的地方：

```tsx
// 替换原来的 hasMore 定义（第 276 行附近）
const hasMore = page < totalPages;

// 在 FilterChips 的 onCategoryChange 中（第 491-494 行），删除 setVisibleCount：
// 修改前：
<FilterChips
  activeCategory={activeCategory}
  onCategoryChange={(cat) => {
    setActiveCategory(cat);
    setVisibleCount(ITEMS_PER_PAGE);  // ← 删除这行
  }}
/>

// 修改后：
<FilterChips
  activeCategory={activeCategory}
  onCategoryChange={(cat) => {
    setActiveCategory(cat);
  }}
/>
```

同时找到第 493 行和 570 行附近的 `setVisibleCount(ITEMS_PER_PAGE)` 调用并删除：
- `onCategoryChange` 中的 `setVisibleCount(ITEMS_PER_PAGE);`
- `onColorSelect` 中的 `setVisibleCount(ITEMS_PER_PAGE);`

- [ ] **步骤 4：重构 loadMore 和 Observer**

替换第 359-381 行的 `loadMore` 回调和 Observer effect：

```tsx
const AUTO_LOAD_PAGES = 3;

// 手动加载更多
const loadMore = useCallback(() => {
  if (isLoadingMore || !hasMore) return;
  const nextPage = page + 1;
  setPage(nextPage);
  fetchImages(nextPage, true);
}, [isLoadingMore, hasMore, page, fetchImages]);

// 混合滚动：自动加载前 3 页，之后只显示按钮
useEffect(() => {
  if (!loadMoreRef.current || !hasMore || isLoadingMore) return;
  if (autoLoadedPages >= AUTO_LOAD_PAGES) return; // 已超过自动加载上限，不建 Observer

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore && autoLoadedPages < AUTO_LOAD_PAGES) {
        setAutoLoadedPages((prev) => prev + 1);
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
      }
    },
    { threshold: 0.1 }
  );
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, isLoadingMore, autoLoadedPages, page, fetchImages]);
```

- [ ] **步骤 5：替换 displayedImages 和 filteredImages 计算**

移除原来的 `filteredImages` 和 `displayedImages`（第 254-276 行），替换为：

```tsx
// 排序和筛选（不再切片，直接返回全量）
const filteredImages = useMemo(() => {
  let result = [...images];

  if (showFavoritesOnly) {
    result = result.filter((img) => favorites.has(img.id));
  }

  if (sortBy === "popular") {
    result.sort((a, b) => b.view_count - a.view_count);
  }

  return result;
}, [images, showFavoritesOnly, favorites, sortBy]);

// 直接用 filteredImages，不再切片
const displayedImages = filteredImages;
```

- [ ] **步骤 6：更新 columns 计算中的依赖**

第 397-416 行的 columns 计算依赖于 `displayedImages`，保持不变（`displayedImages` 现在是全量但仍同名，columns 逻辑无需改动）。

- [ ] **步骤 7：更新「加载更多」按钮文案**

修改第 831-857 行的按钮区域，调整文案以显示正确的进度：

```tsx
{/* Load More */}
{hasMore && (
  <div ref={loadMoreRef} className="flex justify-center mt-8 pb-8">
    <button
      onClick={loadMore}
      disabled={isLoadingMore}
      className={`px-8 py-3 text-sm font-bold rounded-full transition-all duration-200 ${
        isLoadingMore
          ? "bg-[var(--color-surface-card)] text-[var(--color-ash)] cursor-wait"
          : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)] hover:shadow-sm active:scale-95"
      }`}
    >
      {isLoadingMore ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          加载中...
        </span>
      ) : (
        <span>
          加载更多 ({displayedImages.length}/{totalCount})
        </span>
      )}
    </button>
  </div>
)}

{!hasMore && displayedImages.length > 0 && (
  <div className="text-center pb-8 text-sm text-[var(--color-ash)]">
    <span className="inline-flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      已展示全部 {totalCount} 张图片
    </span>
  </div>
)}
```

- [ ] **步骤 8：验证编译**

```bash
cd e:\next_package\blank-wallpaper-society && npx next build --no-lint 2>&1 | tail -20
```

预期：构建成功，无 TypeScript 错误。

- [ ] **步骤 9：Commit**

```bash
git add src/components/MasonryGrid.tsx
git commit -m "feat: 首页改为服务端分页 + 混合滚动（自动3页后手动加载更多）"
```

---

### 任务 2：合集详情页 — 添加 autoLoadedPages 限制

**文件：**
- 修改：`src/app/collections/[id]/page.tsx`

- [ ] **步骤 1：添加 autoLoadedPages 状态**

在 `src/app/collections/[id]/page.tsx` 第 70-71 行附近，添加状态：

```tsx
// 在第 70 行 const [page, setPage] = useState(1); 之后添加：
const [autoLoadedPages, setAutoLoadedPages] = useState(0);
const AUTO_LOAD_PAGES = 3;
```

- [ ] **步骤 2：修改 Observer 回调，加入 autoLoadedPages 条件**

替换第 116-131 行的 Observer effect：

```tsx
// 混合滚动：自动加载前 3 页
useEffect(() => {
  if (!loadMoreRef.current || !hasMore || imagesLoading) return;
  if (autoLoadedPages >= AUTO_LOAD_PAGES) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !imagesLoading && autoLoadedPages < AUTO_LOAD_PAGES) {
        setAutoLoadedPages((prev) => prev + 1);
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
      }
    },
    { threshold: 0.1 }
  );
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, imagesLoading, page, autoLoadedPages, fetchImages]);
```

- [ ] **步骤 3：在 Load More 区域添加手动按钮**

修改第 432-441 行的 Load More 区域，在 loading 状态之上添加按钮：

```tsx
{/* Load More */}
{hasMore && (
  <div ref={loadMoreRef} className="flex justify-center mt-8 pb-8">
    <button
      onClick={() => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
      }}
      disabled={imagesLoading}
      className={`px-8 py-3 text-sm font-bold rounded-full transition-all ${
        imagesLoading
          ? "bg-[var(--color-surface-card)] text-[var(--color-ash)] cursor-wait"
          : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)] hover:shadow-sm active:scale-95"
      }`}
    >
      {imagesLoading ? "加载中..." : `加载更多 (${images.length}/${collection?.image_count || "..."})`}
    </button>
  </div>
)}
```

- [ ] **步骤 4：验证编译**

```bash
cd e:\next_package\blank-wallpaper-society && npx next build --no-lint 2>&1 | tail -20
```

预期：构建成功，无 TypeScript 错误。

- [ ] **步骤 5：Commit**

```bash
git add src/app/collections/[id]/page.tsx
git commit -m "feat: 合集详情页改为混合滚动（自动3页后手动加载更多）"
```

---

### 任务 3：主题专区页 — 添加 autoLoadedPages 限制

**文件：**
- 修改：`src/app/theme-zone/[zoneKey]/page.tsx`

- [ ] **步骤 1：添加 autoLoadedPages 状态**

在 `src/app/theme-zone/[zoneKey]/page.tsx` 第 44 行附近，添加：

```tsx
// 在第 44 行 const [page, setPage] = useState(1); 之后添加：
const [autoLoadedPages, setAutoLoadedPages] = useState(0);
const AUTO_LOAD_PAGES = 3;
```

- [ ] **步骤 2：修改 Observer 回调**

替换第 95-110 行的 Observer effect：

```tsx
// 混合滚动：自动加载前 3 页
useEffect(() => {
  if (!loadMoreRef.current || !hasMore || imagesLoading) return;
  if (autoLoadedPages >= AUTO_LOAD_PAGES) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !imagesLoading && autoLoadedPages < AUTO_LOAD_PAGES) {
        setAutoLoadedPages((prev) => prev + 1);
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
      }
    },
    { threshold: 0.1 }
  );
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, imagesLoading, page, autoLoadedPages, fetchImages]);
```

- [ ] **步骤 3：添加手动加载更多按钮**

修改第 293-304 行的 Load More 区域：

```tsx
{/* Load More */}
{hasMore && (
  <div ref={loadMoreRef} className="flex justify-center mt-8 pb-8">
    <button
      onClick={() => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
      }}
      disabled={imagesLoading}
      className={`px-8 py-3 text-sm font-bold rounded-full transition-all ${
        imagesLoading
          ? "bg-[var(--color-surface-card)] text-[var(--color-ash)] cursor-wait"
          : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)] hover:shadow-sm active:scale-95"
      }`}
    >
      {imagesLoading ? "加载中..." : `加载更多 (${images.length}/${total})`}
    </button>
  </div>
)}
```

- [ ] **步骤 4：验证编译**

```bash
cd e:\next_package\blank-wallpaper-society && npx next build --no-lint 2>&1 | tail -20
```

预期：构建成功，无 TypeScript 错误。

- [ ] **步骤 5：Commit**

```bash
git add src/app/theme-zone/[zoneKey]/page.tsx
git commit -m "feat: 主题专区页改为混合滚动（自动3页后手动加载更多）"
```

---

### 任务 4：整体构建验证

- [ ] **步骤 1：全量构建**

```bash
cd e:\next_package\blank-wallpaper-society && npx next build 2>&1 | tail -30
```

预期：构建成功。

- [ ] **步骤 2：Commit 验证（如有未提交变更）**

```bash
git status
```

预期：working tree clean。
