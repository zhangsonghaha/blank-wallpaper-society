# 混合滚动加载设计规格

## 背景

当前项目中三个图片展示页面均使用 `IntersectionObserver` 无限滚动自动加载。存在问题：

1. **首页 MasonryGrid**：只请求 `limit=100`，之后前端切片模拟分页，无法加载超过 100 张图片
2. **所有页面**：无限滚动导致页面底部 Footer 永远无法到达，用户体验差

## 目标

- 修复首页 100 张图片上限的 bug
- 将无限滚动改为混合模式：自动加载前 3 页（72 张），之后手动「加载更多」
- 确保 Footer 始终可达

---

## 受影响页面

| 文件 | 当前分页方式 | 当前加载方式 |
|------|-------------|-------------|
| `src/components/MasonryGrid.tsx` | 客户端切片，limit=100 | IntersectionObserver |
| `src/app/collections/[id]/page.tsx` | 服务端分页，limit=24 | IntersectionObserver |
| `src/app/theme-zone/[zoneKey]/page.tsx` | 服务端分页，limit=24 | IntersectionObserver |

---

## 统一参数

| 配置项 | 值 |
|--------|-----|
| 每页数量 (`limit`) | 24 |
| 自动加载页数 (`AUTO_LOAD_PAGES`) | 3（共 72 张） |
| 之后行为 | 手动「加载更多」按钮 |
| 按钮文案 | `加载更多 ({当前数}/{总数})` |
| 全部加载后文案 | `已展示全部 {总数} 张图片` |
| 筛选/搜索重置 | `page=1`，`autoLoadedPages` 重置为 0 |

---

## 首页 MasonryGrid 改造

### 状态变更

| 移除 | 新增 |
|------|------|
| `visibleCount` | `page` — 当前页号 |
| — | `autoLoadedPages` — 已自动加载页数 |
| — | `totalPages` — API 返回总页数 |
| — | `isLoadingMore` — 加载中标记 |

### 数据流

```
1. 初始加载: fetchImages(1, append=false)
   → GET /api/images?page=1&limit=24 (+ 筛选参数)
   → setImages(data), setTotalPages(totalPages)
   → hasMore = 1 < totalPages, autoLoadedPages = 0

2. Observer 自动触发 (autoLoadedPages < 3):
   → autoLoadedPages += 1, page += 1
   → fetchImages(page, append=true)
   → images = [...prev, ...newData], hasMore = page < totalPages

3. autoLoadedPages >= 3 后 Observer 断开:
   → 只显示「加载更多」按钮

4. 用户点击按钮:
   → page += 1
   → fetchImages(page, append=true)
   → 同步骤 2

5. hasMore === false:
   → 显示「已展示全部 {n} 张图片」
```

### API 适配

API `/api/images` 已支持 `page` + `limit` 分页参数，返回 `{ data, total, totalPages }`，无需修改。

### 筛选重置

当 `activeCategory`、`searchQuery`、`activeColor`、`sortBy`、`resolutionFilter`、`dateFilter` 任一变化时：
- 重置 `page = 1`
- 重置 `autoLoadedPages = 0`
- 重新 fetch `page=1`（非追加模式）

---

## 合集详情页 & 专题页改造

### 改动点

两个页面结构几乎一致，改动相同：

1. **新增状态** `autoLoadedPages`，初始 0
2. **Observer 回调** 增加条件：`autoLoadedPages < 3` 才自动加载；自动加载后 `autoLoadedPages++`
3. **加载按钮**：`hasMore` 时始终渲染，点击触发手动加载
4. **筛选重置**：加载新数据时 `setAutoLoadedPages(0)`

### 合并改动

```typescript
// 新增
const [autoLoadedPages, setAutoLoadedPages] = useState(0);
const AUTO_LOAD_PAGES = 3;

// Observer 回调修改
useEffect(() => {
  if (!loadMoreRef.current) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !imagesLoading && autoLoadedPages < AUTO_LOAD_PAGES) {
        const nextPage = page + 1;
        setPage(nextPage);
        setAutoLoadedPages((prev) => prev + 1);
        fetchImages(nextPage, true);
      }
    },
    { threshold: 0.1 }
  );
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, imagesLoading, page, autoLoadedPages, fetchImages]);
```

---

## 边界情况

| 场景 | 行为 |
|------|------|
| 总数不足 3 页 | Observer 自动加载完所有页，hasMore 变 false，不出现按钮 |
| 网络错误 | 按钮保持可点击，用户可重试（`catch` 中 `setIsLoadingMore(false)`） |
| 快速连续点击 | `isLoadingMore` 标记防重复请求 |
| 筛选切换 | 重置 page 和 autoLoadedPages，滚动到顶部 |
| 合集/专题页 0 张 | 不展示按钮和 trigger 元素 |

---

## 不涉及

- UI 样式变更（保留现有按钮样式）
- API 后端修改
- 灯箱、收藏等其他交互逻辑
