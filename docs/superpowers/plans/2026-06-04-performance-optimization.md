# 性能优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 分三层优化项目性能 — Bundle 瘦身、服务端缓存、渲染优化

**架构：** 第 1 层用 `next/dynamic` 懒加载重型组件 + CSS 替代 framer-motion + gsap 动态导入；第 2 层扩展 Redis 缓存覆盖高频 API + 主动失效；第 3 层 MasonryGrid 虚拟滚动 + Layout auth 条件化

**技术栈：** Next.js 16, React 19, next/dynamic, Redis (ioredis), IntersectionObserver, CSS @keyframes

---

## 文件结构

### 第 1 层 — 修改文件：
- `src/app/profile/page.tsx` — 静态导入改 dynamic
- `src/app/admin/page.tsx` — 静态导入改 dynamic
- `src/app/upload/page.tsx` — 静态导入改 dynamic
- `src/app/membership/page.tsx` — 静态导入改 dynamic
- `src/app/orders/page.tsx` — 静态导入改 dynamic
- `src/app/messages/page.tsx` — 静态导入改 dynamic
- `src/app/ai-generate/page.tsx` — 静态导入改 dynamic
- `src/app/challenges/page.tsx` — 静态导入改 dynamic
- `src/app/unsubscribe/page.tsx` — 静态导入改 dynamic
- `src/app/pricing/page.tsx` — 静态导入改 dynamic
- `src/app/forgot-password/page.tsx` — motion.div 改 CSS 动画
- `src/app/reset-password/page.tsx` — motion.div 改 CSS 动画
- `src/app/unsubscribe/UnsubscribeClient.tsx` — motion.div 改 CSS 动画
- `src/app/login/page.tsx` — gsap 改动态导入

### 第 2 层 — 修改文件：
- `src/lib/redis.ts` — 新增 CacheKeys 和 CacheTTL
- `src/app/api/images/route.ts` — 添加 getOrSet 缓存
- `src/app/api/images/[id]/route.ts` — 添加 getOrSet 缓存
- `src/app/api/search/route.ts` — 添加 getOrSet 缓存
- `src/app/api/tags/route.ts` — 添加 getOrSet 缓存
- `src/app/api/collections/route.ts` — 添加 getOrSet 缓存
- `src/app/api/posts/route.ts` — 添加 getOrSet 缓存
- `src/app/api/upload/route.ts` — 添加缓存失效
- `src/app/api/images/[id]/route.ts` (PATCH/DELETE) — 添加缓存失效
- `src/app/api/favorites/[imageId]/route.ts` — 添加缓存失效
- `src/app/api/collections/route.ts` (POST) — 添加缓存失效
- `src/app/api/posts/route.ts` (POST) — 添加缓存失效

### 第 3 层 — 修改文件：
- `src/components/MasonryGrid.tsx` — 添加 IntersectionObserver 虚拟滚动
- `src/app/layout.tsx` — 移除 auth() 调用
- `src/components/AuthProvider.tsx` — 移除 session prop

---

## 第 1 层：前端 Bundle 瘦身

### 任务 1：动态导入 10 个重型客户端组件

**文件：**
- 修改：`src/app/profile/page.tsx`
- 修改：`src/app/admin/page.tsx`
- 修改：`src/app/upload/page.tsx`
- 修改：`src/app/membership/page.tsx`
- 修改：`src/app/orders/page.tsx`
- 修改：`src/app/messages/page.tsx`
- 修改：`src/app/ai-generate/page.tsx`
- 修改：`src/app/challenges/page.tsx`
- 修改：`src/app/unsubscribe/page.tsx`
- 修改：`src/app/pricing/page.tsx`

- [ ] **步骤 1：改造 profile/page.tsx**

将静态导入改为 `next/dynamic`，添加 loading skeleton：

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const ProfileClient = dynamic(() => import("./ProfileClient"), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-32 h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/profile");
  }
  const userId = (session.user as any).id;
  const user = await db
    .selectFrom("users")
    .select(["id", "email", "name", "avatar", "role", "is_verified", "created_at"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user) {
    redirect("/");
  }
  const imageStats = await db
    .selectFrom("images")
    .select((eb) => [
      eb.fn.countAll().as("total"),
      eb.fn.coalesce(eb.fn.sum("view_count"), eb.val(0)).as("totalViews"),
    ])
    .where("author", "=", user.name)
    .executeTakeFirst();
  const favStats = await db
    .selectFrom("favorites")
    .select((eb) => eb.fn.countAll().as("total"))
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        is_verified: user.is_verified || 0,
        createdAt: user.created_at instanceof Date ? user.created_at.toISOString() : String(user.created_at),
      }}
      stats={{
        totalImages: Number(imageStats?.total || 0),
        totalViews: Number(imageStats?.totalViews || 0),
        totalFavorites: Number(favStats?.total || 0),
      }}
    />
  );
}
```

- [ ] **步骤 2：改造 admin/page.tsx**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const AdminClient = dynamic(() => import("./AdminClient"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <div className="w-32 h-4 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  const role = (session.user as any)?.role;
  if (role !== "admin" && role !== "moderator") {
    redirect("/");
  }
  return <AdminClient />;
}
```

- [ ] **步骤 3：改造 upload/page.tsx**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const UploadClient = dynamic(() => import("./UploadClient"), {
  loading: () => (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-64 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-48 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/upload");
  }
  return <UploadClient />;
}
```

- [ ] **步骤 4：改造 membership/page.tsx**

```tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const MembershipClient = dynamic(() => import("./MembershipClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "会员中心",
  description: "查看你的会员特权、额度使用和到期信息。",
};

export default function MembershipPage() {
  return <MembershipClient />;
}
```

- [ ] **步骤 5：改造 orders/page.tsx**

```tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const OrdersClient = dynamic(() => import("./OrdersClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col gap-4">
        <div className="w-32 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "我的订单",
  description: "查看你的购买记录和订单状态。",
};

export default function OrdersPage() {
  return <OrdersClient />;
}
```

- [ ] **步骤 6：改造 messages/page.tsx**

```tsx
import { Metadata } from "next";
import dynamic from "next/dynamic";

const MessagesClient = dynamic(() => import("./MessagesClient"), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse flex gap-4">
        <div className="w-72 h-[60vh] rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 h-[60vh] rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "私信 - Blank Wallpaper Society",
  description: "与其他用户进行私密对话",
};

export default function MessagesPage() {
  return <MessagesClient />;
}
```

- [ ] **步骤 7：改造 ai-generate/page.tsx**

```tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const AiGenerateClient = dynamic(() => import("./AiGenerateClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "AI壁纸生成",
  description: "使用AI生成独一无二的壁纸，支持多种风格选择。",
};

export default function AiGeneratePage() {
  return <AiGenerateClient />;
}
```

- [ ] **步骤 8：改造 challenges/page.tsx**

```tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ChallengesClient = dynamic(() => import("./ChallengesClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "挑战赛",
  description: "参加壁纸挑战赛，展示你的创作才华，赢取经验值奖励！",
};

export default function ChallengesPage() {
  return <ChallengesClient />;
}
```

- [ ] **步骤 9：改造 unsubscribe/page.tsx**

```tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";

const UnsubscribeClient = dynamic(() => import("./UnsubscribeClient"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse w-64 h-8 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  ),
});

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeClient />
    </Suspense>
  );
}
```

- [ ] **步骤 10：改造 pricing/page.tsx**

```tsx
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PricingClient = dynamic(() => import("./PricingClient"), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-48 h-8 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-72 h-4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "会员定价",
  description: "选择适合你的会员方案，解锁更多高清壁纸和专属功能。",
  openGraph: {
    title: "ImageGallery 会员定价",
    description: "选择适合你的会员方案，解锁更多高清壁纸和专属功能。",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
```

- [ ] **步骤 11：运行构建验证**

运行：`pnpm build`
预期：构建成功，无报错

- [ ] **步骤 12：Commit**

```bash
git add src/app/profile/page.tsx src/app/admin/page.tsx src/app/upload/page.tsx src/app/membership/page.tsx src/app/orders/page.tsx src/app/messages/page.tsx src/app/ai-generate/page.tsx src/app/challenges/page.tsx src/app/unsubscribe/page.tsx src/app/pricing/page.tsx
git commit -m "perf: 动态导入10个重型客户端组件，减少初始JS bundle体积"
```

---

### 任务 2：CSS 动画替代 framer-motion（3 个页面）

**文件：**
- 修改：`src/app/forgot-password/page.tsx`
- 修改：`src/app/reset-password/page.tsx`
- 修改：`src/app/unsubscribe/UnsubscribeClient.tsx`

注意：`globals.css` 已有 `@keyframes fadeInUp` 和 `.pin-enter` 类，可复用。

- [ ] **步骤 1：改造 forgot-password/page.tsx**

移除 `import { motion } from "framer-motion"`，将 `<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>` 替换为 `<div className="animate-fade-in-up">`（使用 globals.css 中已有的 `.pin-enter` 或新增 `.animate-fade-in-up`）。

具体改动：
- 删除第 5 行 `import { motion } from "framer-motion";`
- 第 71 行 `<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` → `<div className="pin-enter"`
- 第 188 行 `</motion.div>` → `</div>`

- [ ] **步骤 2：改造 reset-password/page.tsx**

移除 `import { motion } from "framer-motion"`，将 `<motion.div>` 替换为 `<div className="pin-enter">`。

具体改动：
- 删除第 7 行 `import { motion } from "framer-motion";`
- 第 180 行 `<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` → `<div className="pin-enter"`
- 第 189 行 `</motion.div>` → `</div>`

- [ ] **步骤 3：改造 UnsubscribeClient.tsx**

读取文件确认 motion 使用方式，然后移除 framer-motion 导入，替换 `<motion.div>` 为 `<div className="pin-enter">`。

- [ ] **步骤 4：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 5：Commit**

```bash
git add src/app/forgot-password/page.tsx src/app/reset-password/page.tsx src/app/unsubscribe/UnsubscribeClient.tsx
git commit -m "perf: 3个简单页面用CSS动画替代framer-motion，减少bundle体积"
```

---

### 任务 3：gsap 动态导入（登录页）

**文件：**
- 修改：`src/app/login/page.tsx`

当前 gsap 在模块顶部静态导入（第 7 行），在 3 处使用：intro 动画（第 336 行）、3D tilt 效果（第 405/408 行）、tab 切换动画（第 428 行）。

- [ ] **步骤 1：将 gsap 改为 useEffect 内动态导入**

删除顶部 `import { gsap } from "gsap";`（第 7 行）。

在使用 gsap 的每个 useEffect 中改为动态导入。由于有 3 处使用，最简洁的方式是在文件顶部创建一个 gsap ref：

在组件函数体内添加：
```tsx
const gsapRef = useRef<typeof import("gsap")["gsap"] | null>(null);

useEffect(() => {
  import("gsap").then((mod) => {
    gsapRef.current = mod.gsap;
  });
}, []);
```

然后将所有 `gsap.timeline(...)` 改为 `gsapRef.current?.timeline(...)`，`gsap.to(...)` 改为 `gsapRef.current?.to(...)`，`gsap.fromTo(...)` 改为 `gsapRef.current?.fromTo(...)`。

具体改动点：
- 第 336 行：`gsap.timeline(...)` → `gsapRef.current?.timeline(...)`
- 第 405 行：`gsap.to(card, ...)` → `gsapRef.current?.to(card, ...)`
- 第 408 行：`gsap.to(cardRef.current, ...)` → `gsapRef.current?.to(cardRef.current, ...)`
- 第 428 行：`gsap.fromTo(card, ...)` → `gsapRef.current?.fromTo(card, ...)`

- [ ] **步骤 2：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 3：Commit**

```bash
git add src/app/login/page.tsx
git commit -m "perf: gsap改为动态导入，仅在登录页按需加载"
```

---

## 第 2 层：服务端缓存扩展

### 任务 4：扩展 CacheKeys 和 CacheTTL

**文件：**
- 修改：`src/lib/redis.ts`

- [ ] **步骤 1：在 CacheKeys 中添加新 key**

在 `CacheKeys` 对象（约第 29-50 行）的 `FEED_TRENDING` 之后添加：

```ts
  /** 图片列表 images:list:{serializedParams} */
  IMAGES_LIST: (params: string) => `images:list:${params}`,
  /** 图片详情 images:detail:{id} */
  IMAGE_DETAIL: (id: number) => `images:detail:${id}`,
  /** 搜索结果 search:{query}:{page} */
  SEARCH_RESULTS: (query: string, page: number) => `search:${encodeURIComponent(query)}:${page}`,
  /** 标签列表 */
  TAGS_LIST: "tags:list",
  /** 合集列表 collections:list:{serializedParams} */
  COLLECTIONS_LIST: (params: string) => `collections:list:${params}`,
  /** 帖子列表 posts:list:{page} */
  POSTS_LIST: (page: number) => `posts:list:${page}`,
```

- [ ] **步骤 2：在 CacheTTL 中添加新 TTL**

在 `CacheTTL` 对象（约第 55-65 行）的 `FEED_TRENDING` 之后添加：

```ts
  IMAGES_LIST: 60,         // 1 分钟
  IMAGE_DETAIL: 300,       // 5 分钟
  SEARCH_RESULTS: 120,     // 2 分钟
  TAGS_LIST: 600,          // 10 分钟
  COLLECTIONS_LIST: 300,   // 5 分钟
  POSTS_LIST: 300,         // 5 分钟
```

- [ ] **步骤 3：Commit**

```bash
git add src/lib/redis.ts
git commit -m "perf: 扩展Redis缓存Key和TTL常量，为高频API添加缓存准备"
```

---

### 任务 5：为 images 列表 API 添加缓存

**文件：**
- 修改：`src/app/api/images/route.ts`

images 列表是最复杂的 API，查询参数众多。使用序列化参数作为缓存 key。

- [ ] **步骤 1：添加缓存导入和 key 生成逻辑**

在文件顶部添加：
```ts
import { getOrSet, CacheKeys, CacheTTL } from "@/lib/redis";
```

在 GET 函数中，解析完 searchParams 后（约第 34 行之后），为公开请求生成缓存 key：

```ts
// 缓存：仅对公开请求（非 my=true）使用缓存
const cacheParams = searchParams.toString();
const isCacheable = !myImages && !showAll && request.method === "GET";
```

- [ ] **步骤 2：用 getOrSet 包装数据库查询结果**

在构建完查询并返回 NextResponse.json 之前，将整个查询逻辑包装在 getOrSet 中。

由于 images/route.ts 逻辑复杂（Meilisearch 路径 + Kysely 路径 + 颜色过滤），最安全的做法是在最终 `return NextResponse.json(...)` 之前，将数据获取逻辑提取为 async 函数传给 getOrSet。

**简化方案：** 对最终 JSON 响应做缓存，而非改造内部逻辑。在函数末尾统一处理：

在 try 块开头添加缓存检查：
```ts
if (isCacheable) {
  const cached = await getCache<{ data: any; total: number; page: number; limit: number; totalPages: number }>(
    CacheKeys.IMAGES_LIST(cacheParams)
  );
  if (cached) {
    return NextResponse.json(cached);
  }
}
```

在每个 `return NextResponse.json(...)` 处（成功响应），在返回前添加缓存写入：
```ts
const responseData = { data: rows, total, page, limit, totalPages };
if (isCacheable) {
  setCache(CacheKeys.IMAGES_LIST(cacheParams), responseData, CacheTTL.IMAGES_LIST).catch(() => {});
}
return NextResponse.json(responseData);
```

注意：这里用 getCache + setCache 而非 getOrSet，因为 images/route.ts 有多个 return 路径（Meilisearch 路径和 SQL 路径），不适合单一的 fetcher 函数。

- [ ] **步骤 3：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 4：Commit**

```bash
git add src/app/api/images/route.ts
git commit -m "perf: 为images列表API添加Redis缓存，TTL 60秒"
```

---

### 任务 6：为其他高频 API 添加缓存

**文件：**
- 修改：`src/app/api/images/[id]/route.ts`
- 修改：`src/app/api/tags/route.ts`
- 修改：`src/app/api/collections/route.ts`
- 修改：`src/app/api/posts/route.ts`

- [ ] **步骤 1：images/[id] 详情缓存**

在 `src/app/api/images/[id]/route.ts` 的 GET handler 中：
- 添加导入：`import { getOrSet, CacheKeys, CacheTTL } from "@/lib/redis";`
- 用 getOrSet 包装数据库查询：

```ts
const imageId = parseInt(params.id);
const result = await getOrSet(CacheKeys.IMAGE_DETAIL(imageId), async () => {
  // ... 原有的数据库查询逻辑 ...
  return responseData;
}, CacheTTL.IMAGE_DETAIL);
return NextResponse.json(result);
```

- [ ] **步骤 2：tags 列表缓存**

在 `src/app/api/tags/route.ts` 的 GET handler 中：
- 添加导入：`import { getOrSet, CacheKeys, CacheTTL } from "@/lib/redis";`
- 用 getOrSet 包装：

```ts
const tags = await getOrSet(CacheKeys.TAGS_LIST, async () => {
  // ... 原有查询逻辑 ...
  return tagsData;
}, CacheTTL.TAGS_LIST);
return NextResponse.json({ data: tags });
```

- [ ] **步骤 3：collections 列表缓存**

在 `src/app/api/collections/route.ts` 的 GET handler 中：
- 添加导入：`import { getOrSet, delCache, clearPattern, CacheKeys, CacheTTL } from "@/lib/redis";`
- 对公开 GET 请求用 getOrSet 包装
- 对 POST（创建合集）添加 `clearPattern("collections:list:*")`

- [ ] **步骤 4：posts 列表缓存**

在 `src/app/api/posts/route.ts` 的 GET handler 中：
- 添加导入：`import { getOrSet, clearPattern, CacheKeys, CacheTTL } from "@/lib/redis";`
- 用 getOrSet 包装 GET 查询
- 对 POST（发布帖子）添加 `clearPattern("posts:list:*")`

- [ ] **步骤 5：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 6：Commit**

```bash
git add src/app/api/images/[id]/route.ts src/app/api/tags/route.ts src/app/api/collections/route.ts src/app/api/posts/route.ts
git commit -m "perf: 为图片详情、标签、合集、帖子API添加Redis缓存"
```

---

### 任务 7：缓存失效策略

**文件：**
- 修改：`src/app/api/upload/route.ts`
- 修改：`src/app/api/images/[id]/route.ts`（PATCH/DELETE）
- 修改：`src/app/api/favorites/[imageId]/route.ts`

- [ ] **步骤 1：上传图片时清除列表缓存**

在 `src/app/api/upload/route.ts` 中，图片成功插入数据库后，添加：

```ts
import { clearPattern } from "@/lib/redis";
// ... 在成功插入后 ...
clearPattern("images:list:*").catch(() => {});
```

注意：upload/route.ts 有两处成功路径（URL 模式和文件上传模式），都需要添加。

- [ ] **步骤 2：编辑/删除图片时清除缓存**

在 `src/app/api/images/[id]/route.ts` 的 PATCH 和 DELETE handler 中，成功操作后添加：

```ts
import { delCache, clearPattern, CacheKeys } from "@/lib/redis";
// PATCH 成功后
delCache(CacheKeys.IMAGE_DETAIL(imageId)).catch(() => {});
clearPattern("images:list:*").catch(() => {});

// DELETE 成功后
delCache(CacheKeys.IMAGE_DETAIL(imageId)).catch(() => {});
clearPattern("images:list:*").catch(() => {});
```

- [ ] **步骤 3：收藏/取消收藏时清除列表缓存**

在 `src/app/api/favorites/[imageId]/route.ts` 的 POST（收藏）和 DELETE（取消收藏）中，成功后添加：

```ts
import { clearPattern } from "@/lib/redis";
// 成功后
clearPattern("images:list:*").catch(() => {});
```

- [ ] **步骤 4：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 5：Commit**

```bash
git add src/app/api/upload/route.ts src/app/api/images/[id]/route.ts src/app/api/favorites/[imageId]/route.ts
git commit -m "perf: 添加缓存失效策略，数据变更时自动清除相关缓存"
```

---

## 第 3 层：渲染性能 + Layout 优化

### 任务 8：MasonryGrid IntersectionObserver 虚拟滚动

**文件：**
- 修改：`src/components/MasonryGrid.tsx`

- [ ] **步骤 1：添加 IntersectionObserver 逻辑**

在 MasonryGrid 组件中，添加基于 IntersectionObserver 的懒渲染机制：

```tsx
// 在组件内部添加
const [visibleIds, setVisibleIds] = useState<Set<number>>(new Set());
const observerRef = useRef<IntersectionObserver | null>(null);
const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

// 在 useEffect 中初始化 observer
useEffect(() => {
  observerRef.current = new IntersectionObserver(
    (entries) => {
      setVisibleIds((prev) => {
        const next = new Set(prev);
        entries.forEach((entry) => {
          const id = Number(entry.target.getAttribute("data-image-id"));
          if (entry.isIntersecting) {
            next.add(id);
          }
          // 不主动移除——一旦渲染过就保持，避免闪烁
        });
        return next;
      });
    },
    {
      rootMargin: "1200px 0px", // 上下各预加载约 2 屏
      threshold: 0,
    }
  );
  return () => observerRef.current?.disconnect();
}, []);

// 注册卡片到 observer
const registerCard = useCallback((id: number, el: HTMLDivElement | null) => {
  if (el) {
    cardRefs.current.set(id, el);
    observerRef.current?.observe(el);
  } else {
    const existing = cardRefs.current.get(id);
    if (existing) {
      observerRef.current?.unobserve(existing);
      cardRefs.current.delete(id);
    }
  }
}, []);
```

- [ ] **步骤 2：在卡片渲染处应用虚拟滚动**

将现有的 PinCard 渲染逻辑修改为：

```tsx
// 初始渲染前 N 张（首屏不需要 observer）
const INITIAL_VISIBLE_COUNT = 24; // 首屏数量

// 在渲染卡片时
{images.map((image, index) => {
  const isVisible = index < INITIAL_VISIBLE_COUNT || visibleIds.has(image.id);
  return (
    <div
      key={image.id}
      ref={(el) => registerCard(image.id, el)}
      data-image-id={image.id}
      style={{ minHeight: isVisible ? undefined : estimatedHeight(image) }}
    >
      {isVisible ? (
        <PinCard image={image} ... />
      ) : (
        <div style={{ height: estimatedHeight(image) }} />
      )}
    </div>
  );
})}
```

其中 `estimatedHeight` 根据图片宽高比计算：
```ts
function estimatedHeight(image: { width: number; height: number }): number {
  const columnWidth = 300; // 估算列宽
  return Math.round((image.height / image.width) * columnWidth);
}
```

- [ ] **步骤 3：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 4：Commit**

```bash
git add src/components/MasonryGrid.tsx
git commit -m "perf: MasonryGrid添加IntersectionObserver虚拟滚动，减少DOM节点数量"
```

---

### 任务 9：Layout auth() 条件化

**文件：**
- 修改：`src/app/layout.tsx`
- 修改：`src/components/AuthProvider.tsx`

- [ ] **步骤 1：修改 AuthProvider 移除 session prop**

将 `src/components/AuthProvider.tsx` 改为不依赖外部传入的 session：

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

`SessionProvider` 不传 session 时会自动从 `/api/auth/session` 获取，客户端组件通过 `useSession()` 拿到的值不变。

- [ ] **步骤 2：修改 layout.tsx 移除 auth() 调用**

将 `src/app/layout.tsx` 中的 auth 相关代码移除：

修改前：
```tsx
import { auth } from "@/lib/auth";
// ...
export default async function RootLayout({ children }) {
  const session = await auth();
  return (
    // ...
    <AuthProvider session={session}>
```

修改后：
```tsx
// 删除 import { auth } from "@/lib/auth";
// ...
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // ...
    <AuthProvider>
```

注意：`RootLayout` 不再有 `async`，因为不再需要 await。

- [ ] **步骤 3：验证认证页面仍正常工作**

确认以下页面已自行调用 `auth()`：
- `src/app/profile/page.tsx` ✅ 已有 `const session = await auth()`
- `src/app/admin/page.tsx` ✅ 已有 `const session = await auth()`
- `src/app/upload/page.tsx` ✅ 已有 `const session = await auth()`

其他需要认证的页面（如 messages、orders 等），它们依赖客户端 `useSession()` 通过 AuthProvider 获取，不受影响。

- [ ] **步骤 4：运行构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 5：Commit**

```bash
git add src/app/layout.tsx src/components/AuthProvider.tsx
git commit -m "perf: Layout移除auth()调用，公开页面不再触发session验证开销"
```

---

## 最终验证

### 任务 10：全量构建验证

- [ ] **步骤 1：完整构建**

运行：`pnpm build`
预期：构建成功，无 TypeScript 错误

- [ ] **步骤 2：验证第 1 层效果**

检查 `.next/static/chunks/` 目录中是否有独立的 chunk 文件对应各动态导入的组件。

- [ ] **步骤 3：启动开发服务器测试**

运行：`pnpm dev`

手动验证：
1. 访问 /profile — 看到 loading skeleton 后加载完整页面
2. 访问 /admin — 看到 loading 后加载
3. 访问 /upload — 看到 loading 后加载
4. 访问 /forgot-password — 看到淡入动画（CSS）
5. 访问 /login — gsap 动画正常
6. 访问首页 — 图片瀑布流正常渲染和滚动

- [ ] **步骤 4：最终 Commit**

```bash
git add -A
git commit -m "perf: 三层性能优化完成 — Bundle瘦身+Redis缓存+渲染优化"
```
