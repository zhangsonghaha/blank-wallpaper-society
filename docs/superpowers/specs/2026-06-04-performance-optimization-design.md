# 性能优化设计规格 — 分层 Bundle 瘦身 + 缓存 + 渲染优化

## 概述

针对壁纸画廊项目的三层性能优化方案，按投入产出比分层执行，每层独立交付。

## 背景

项目当前性能瓶颈：
- 14 个大型客户端组件（总计 15000+ 行）全部静态导入，撑大初始 JS bundle
- `framer-motion`（~150KB gzip）在 25+ 个组件中被引入
- `gsap` 仅登录页使用但作为全局依赖打包
- Redis 缓存只覆盖 ~12 个 API，高频接口（images 列表/详情/搜索）无缓存
- MasonryGrid 无虚拟滚动，大量图片时 DOM 节点爆炸
- Layout 每个请求（含公开页面）都调用 `await auth()`

## 第 1 层：前端 Bundle 瘦身（最高 ROI）

### 1.1 动态导入重型客户端组件

使用 `next/dynamic` 对非首屏客户端组件进行懒加载。

**改造文件清单：**

| 页面文件 | 客户端组件 | 行数 | 改动 |
|---------|-----------|------|------|
| `src/app/profile/page.tsx` | ProfileClient | 2156 | `dynamic(() => import("./ProfileClient"))` |
| `src/app/admin/page.tsx` | AdminClient | - | `dynamic(() => import("./AdminClient"))` |
| `src/app/upload/page.tsx` | UploadClient | 987 | `dynamic(() => import("./UploadClient"))` |
| `src/app/membership/page.tsx` | MembershipClient | - | `dynamic(() => import("./MembershipClient"))` |
| `src/app/orders/page.tsx` | OrdersClient | - | `dynamic(() => import("./OrdersClient"))` |
| `src/app/messages/page.tsx` | MessagesClient | - | `dynamic(() => import("./MessagesClient"))` |
| `src/app/ai-generate/page.tsx` | AiGenerateClient | - | `dynamic(() => import("./AiGenerateClient"))` |
| `src/app/challenges/page.tsx` | ChallengesClient | 784 | `dynamic(() => import("./ChallengesClient"))` |
| `src/app/unsubscribe/page.tsx` | UnsubscribeClient | - | `dynamic(() => import("./UnsubscribeClient"))` |
| `src/app/pricing/page.tsx` | PricingClient | - | `dynamic(() => import("./PricingClient"))` |

**不改造的组件：**
- `FeedClient` — 首页核心内容，需首屏渲染
- `ImageDetailClient` — 图片详情页核心内容

**改造模式：**

```tsx
// 改造前
import ProfileClient from "./ProfileClient";

// 改造后
import dynamic from "next/dynamic";
const ProfileClient = dynamic(() => import("./ProfileClient"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});
```

每个页面的 loading skeleton 根据页面内容定制，保持视觉一致性。

### 1.2 CSS 动画替代 framer-motion

以下页面仅使用基础淡入/滑入动画，用 CSS `@keyframes` 替代：

| 文件 | 当前用法 | 替代方案 |
|------|---------|---------|
| `src/app/forgot-password/page.tsx` | `motion.div` 淡入 | CSS `@keyframes fadeIn` |
| `src/app/reset-password/page.tsx` | `motion.div` 淡入 | CSS `@keyframes fadeIn` |
| `src/app/unsubscribe/UnsubscribeClient.tsx` | `motion.div` 淡入 | CSS `@keyframes fadeIn` |

**CSS 动画模板（添加到 globals.css 或内联）：**

```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out;
}
```

### 1.3 gsap 动态导入

`src/app/login/page.tsx` 中的 gsap 改为动态导入：

```tsx
// 改造前
import { gsap } from "gsap";

// 改造后 — 在 useEffect 中动态导入
useEffect(() => {
  import("gsap").then(({ gsap }) => {
    // 动画逻辑
  });
}, []);
```

## 第 2 层：服务端缓存扩展

### 2.1 新增缓存 Key 和 TTL

在 `src/lib/redis.ts` 的 `CacheKeys` 和 `CacheTTL` 中添加：

```ts
// CacheKeys 新增
IMAGES_LIST: (params: string) => `images:list:${params}`,
IMAGE_DETAIL: (id: number) => `images:detail:${id}`,
SEARCH_RESULTS: (query: string, page: number) => `search:${query}:${page}`,
TAGS_LIST: "tags:list",
COLLECTIONS_LIST: (params: string) => `collections:list:${params}`,
POSTS_LIST: (page: number) => `posts:list:${page}`,

// CacheTTL 新增
IMAGES_LIST: 60,         // 1 分钟（列表数据变化快）
IMAGE_DETAIL: 300,       // 5 分钟
SEARCH_RESULTS: 120,     // 2 分钟
TAGS_LIST: 600,          // 10 分钟
COLLECTIONS_LIST: 300,   // 5 分钟
POSTS_LIST: 300,         // 5 分钟
```

### 2.2 缓存应用路由

为以下 API 路由添加 `getOrSet` 缓存包装：

- `GET /api/images` — 使用序列化查询参数作为 key
- `GET /api/images/[id]` — 使用图片 ID 作为 key
- `GET /api/search/*` — 使用搜索词 + 分页作为 key
- `GET /api/tags` — 固定 key
- `GET /api/collections` — 使用查询参数作为 key
- `GET /api/posts` — 使用分页参数作为 key

### 2.3 缓存失效策略

在数据变更操作中添加 `delCache` / `clearPattern`：

- **上传图片**（POST /api/upload）：`clearPattern("images:list:*")`
- **编辑/删除图片**（PATCH/DELETE /api/images/[id]）：`delCache(CacheKeys.IMAGE_DETAIL(id))` + `clearPattern("images:list:*")`
- **收藏/取消收藏**：`clearPattern("images:list:*")`（因为列表含 is_favorite 字段）
- **创建/编辑合集**：`clearPattern("collections:list:*")`
- **发布帖子**：`clearPattern("posts:list:*")`

## 第 3 层：渲染性能 + Layout 优化

### 3.1 MasonryGrid 虚拟滚动

使用 `IntersectionObserver` 实现懒渲染（不引入 react-window，因为瀑布流不等高）：

**策略：**
- 将图片按列分组，每列维护独立的高度跟踪
- 使用 `IntersectionObserver` 监听每个卡片的可见性
- 视口外超过 2 屏的卡片替换为占位符（保持原始高度的空 div）
- 图片元素使用 `loading="lazy"` 属性

**实现位置：** `src/components/MasonryGrid.tsx` 内部重构，不影响外部接口。

### 3.2 Layout auth() 条件化

**改造前（`src/app/layout.tsx`）：**
```tsx
const session = await auth(); // 每个请求都调用
```

**改造后：**
- 移除 layout.tsx 中的 `await auth()` 调用
- `AuthProvider` 组件（client component）内部通过 `useSession()` 获取 session
- 需要服务端 session 的页面（profile、admin、upload）在自己的 page.tsx 中调用 `auth()`
- Navbar 作为 client component 已经使用 `useSession()`，无需改变

**影响范围：**
- `src/app/layout.tsx` — 移除 auth() 调用和 session prop
- `src/components/AuthProvider.tsx` — 移除 session prop，完全依赖客户端 useSession
- 需要认证的页面 — 确认已自行调用 auth()（当前 profile、admin、upload 页面已有）

## 验证策略

每层完成后验证：

1. **第 1 层验证：**
   - `pnpm build` 成功
   - 检查 `.next/static/chunks/` 目录，确认大型组件被拆分为独立 chunk
   - 手动访问各页面确认功能正常

2. **第 2 层验证：**
   - 缓存命中测试：连续两次请求同一 API，第二次应明显更快
   - 缓存失效测试：上传图片后 images 列表缓存应被清除
   - Redis 宕机时 graceful fallback 到直接查询

3. **第 3 层验证：**
   - MasonryGrid 加载 200+ 张图片时滚动流畅
   - 公开页面（首页）不再触发 auth() 调用
   - 认证页面功能不受影响

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 动态导入导致首次访问闪烁 | 提供 loading skeleton 占位 |
| CSS 动画不如 framer-motion 流畅 | 仅对简单动画页面替换，复杂动画保留 |
| 缓存数据不一致 | 合理设置 TTL + 数据变更时主动失效 |
| 虚拟滚动影响 SEO | 服务端仍渲染初始图片，客户端接管滚动 |
| Layout auth 移除后 Navbar 状态延迟 | Navbar 已有 useSession() 客户端获取，体验不变 |
