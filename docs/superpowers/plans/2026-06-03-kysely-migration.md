# Kysely Query Builder 迁移实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将项目全部 776 处 mysql2 原生 SQL 调用迁移到 Kysely 类型安全 query builder

**架构：** 薄封装方案 — 在 `db.ts` 中暴露 Kysely `db` 实例 + `safeExecute()` 容错函数 + 重试插件，所有调用点改为 Kysely DSL。迁移期间保留旧 `query()`/`safeQuery()` 兼容，最终清理。

**技术栈：** Kysely + kysely-codegen + mysql2（连接池复用）

**设计规格：** `docs/superpowers/specs/2026-06-03-kysely-query-builder-design.md`

---

## 迁移模式速查表

所有迁移任务都遵循以下模式：

### Import 变更
```ts
// 删除
import { query } from "@/lib/db";
import { query, safeQuery } from "@/lib/db";
import { query, getConnection } from "@/lib/db";
import { withTransaction } from "@/lib/db-tx";

// 替换为
import { db } from "@/lib/db";
import { db, safeExecute } from "@/lib/db";          // 如果用到 safeQuery
import { db } from "@/lib/db";                        // 如果用到 getConnection（改用 db.transaction()）
// db-tx 的 withTransaction → 直接用 db.transaction().execute(async (trx) => { ... })
```

### SELECT 模式
```ts
// query("SELECT * FROM table WHERE col = ?", [val]) as any[]
db.selectFrom("table").where("col", "=", val).selectAll().execute()

// query("SELECT col1, col2 FROM table WHERE ...", [...]) as any[]
db.selectFrom("table").select(["col1", "col2"]).where(...).execute()

// query("SELECT COUNT(*) as count FROM table WHERE ...", [...]) as any[]
db.selectFrom("table").select((eb) => eb.fn.countAll().as("count")).where(...).executeTakeFirst()

// safeQuery("SELECT ...", [...], defaultValue)
safeExecute(() => db.selectFrom("...").where(...).selectAll().execute(), defaultValue, "label")
```

### INSERT 模式
```ts
// query("INSERT INTO table (a, b) VALUES (?, ?)", [a, b])
db.insertInto("table").values({ a, b }).execute()

// 获取 insertId: const [result] = await pool.execute(...)
const result = await db.insertInto("table").values({ a, b }).executeTakeFirst()
// result.insertId
```

### UPDATE 模式
```ts
// query("UPDATE table SET a = ? WHERE id = ?", [a, id])
db.updateTable("table").set({ a }).where("id", "=", id).execute()
```

### DELETE 模式
```ts
// query("DELETE FROM table WHERE id = ?", [id])
db.deleteFrom("table").where("id", "=", id).execute()
```

### IN 查询
```ts
// const ph = ids.map(() => "?").join(","); query(`...IN (${ph})`, ids)
db.selectFrom("table").where("id", "in", ids).selectAll().execute()
```

### 事务模式
```ts
// Before: const conn = await getConnection(); try { await conn.beginTransaction(); ... await conn.commit(); } catch { await conn.rollback(); } finally { conn.release(); }
// After:
await db.transaction().execute(async (trx) => {
  // 用 trx 代替 conn，所有操作自动 commit/rollback/release
});

// Before: withTransaction(async (conn) => { ... })
// After:
db.transaction().execute(async (trx) => { ... })
```

### FOR UPDATE
```ts
db.selectFrom("table").where(...).forUpdate().selectAll().executeTakeFirst()
```

### 注意事项
- 移除所有 `as any[]` 类型断言
- `result.insertId` 需要 `executeTakeFirst()` 而非 `execute()`
- Kysely 的 `COUNT()` 返回 `string | number | bigint`，需要 `Number()` 转换
- `COALESCE(SUM(...), 0)` 等聚合用 `eb.fn.coalesce(eb.fn.sum(...), eb.val(0))` 或直接 SQL 表达式
- 对于特别复杂的 SQL（子查询、CASE WHEN），可用 `db.raw()` 或 `sql<string>` 模板标签

---

## 文件结构

### 新增文件
- `src/lib/db-types.ts` — kysely-codegen 自动生成的 Database 类型接口

### 修改文件
- `package.json` — 新增 kysely + kysely-codegen 依赖
- `src/lib/db.ts` — 重构为 Kysely 实例 + safeExecute + 重试插件
- `src/lib/db-tx.ts` — 简化为仅 withTransactionSafe()
- ~147 个使用 `query()`/`safeQuery()`/`withTransaction()` 的文件 — 按上述模式迁移

---

## Task 1：基础设施搭建

**文件：**
- 修改：`package.json`
- 创建：`src/lib/db-types.ts`
- 修改：`src/lib/db.ts`
- 修改：`src/lib/db-tx.ts`

- [ ] **步骤 1：安装依赖**

```bash
pnpm add kysely
pnpm add -D kysely-codegen
```

- [ ] **步骤 2：生成 Database 类型**

```bash
npx kysely-codegen --dialect mysql --connection-string "mysql://zhangsong:zs15210265092!@rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com:3306/img" --out-file src/lib/db-types.ts
```

预期：生成 `src/lib/db-types.ts`，包含所有表的 TypeScript 接口。

- [ ] **步骤 3：重构 db.ts**

替换 `src/lib/db.ts` 全部内容：

```ts
import { Kysely, MysqlDialect, type KyselyPlugin } from "kysely";
import mysql from "mysql2/promise";
import type { Database } from "./db-types";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "img",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "15"),
  queueLimit: 0,
  ssl: undefined,
  connectTimeout: 10000,
  idleTimeout: 60000,
  maxIdle: 5,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

const RETRYABLE_ERRORS = ["ETIMEDOUT", "ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE"];

const retryPlugin: KyselyPlugin = {
  transformQuery(args, next) {
    return next.transformQuery(args);
  },
  async transformResult(args, next) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await next.transformResult(args);
      } catch (error: any) {
        const code = error?.code || "";
        if (attempt === 0 && RETRYABLE_ERRORS.includes(code)) {
          console.warn(`Kysely retry (${code})`);
          continue;
        }
        throw error;
      }
    }
    throw new Error("Retry logic exhausted unexpectedly");
  },
};

export const db = new Kysely<Database>({
  dialect: new MysqlDialect({ pool: pool.pool }),
  plugins: [retryPlugin],
});

export async function safeExecute<T>(
  queryFn: () => Promise<T>,
  fallback: T,
  label?: string
): Promise<T> {
  try {
    return await queryFn();
  } catch (error: any) {
    console.warn(`safeExecute fallback (${label || "unknown"}):`, error);
    return fallback;
  }
}

// ── 兼容期：保留旧函数，迁移完成后删除 ──
export async function query(sql: string, params?: any[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (error: any) {
      const code = error?.code || "";
      if (attempt === 0 && RETRYABLE_ERRORS.includes(code)) {
        console.warn(`DB query retry (${code}): ${sql}`);
        continue;
      }
      console.error(`DB query error: ${sql}`, error);
      throw error;
    }
  }
}

export async function safeQuery(sql: string, params?: any[], defaultValue: any = []) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [rows] = await pool.execute(sql, params);
      return rows;
    } catch (error: any) {
      const code = error?.code || "";
      if (attempt === 0 && RETRYABLE_ERRORS.includes(code)) {
        console.warn(`DB safeQuery retry (${code}): ${sql}`);
        continue;
      }
      console.warn(`DB safeQuery fallback (using default): ${sql}`, error);
      return defaultValue;
    }
  }
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
```

- [ ] **步骤 4：简化 db-tx.ts**

替换 `src/lib/db-tx.ts` 全部内容：

```ts
import { db } from "@/lib/db";
import type { Database } from "@/lib/db-types";
import type { Transaction } from "kysely";

/**
 * 安全事务包装 — 失败时不抛异常，返回 { data, error }
 */
export async function withTransactionSafe<T>(
  fn: (trx: Transaction<Database>) => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await db.transaction().execute(fn);
    return { data, error: null };
  } catch (error: any) {
    console.error("[Transaction] 事务执行失败:", error);
    return { data: null, error: error.message || "事务执行失败" };
  }
}

// ── 兼容期：保留旧 withTransaction，迁移完成后删除 ──
import pool, { getConnection } from "@/lib/db";

export async function withTransaction<T>(
  fn: (conn: ReturnType<typeof pool.getConnection> extends Promise<infer U> ? U : never) => Promise<T>
): Promise<T> {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn as any);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
```

- [ ] **步骤 5：验证基础设施**

运行：`npx tsc --noEmit`
预期：无类型错误（旧代码仍使用旧函数，类型兼容）

- [ ] **步骤 6：Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/db.ts src/lib/db-types.ts src/lib/db-tx.ts
git commit -m "feat: introduce Kysely query builder infrastructure"
```

---

## Task 2：迁移 lib 核心模块（auth + login-security）

**文件：**
- 修改：`src/lib/auth.ts`（7 处调用）

- [ ] **步骤 1：迁移 auth.ts**

将 `import { query } from "@/lib/db"` 改为 `import { db } from "@/lib/db"`。
按迁移模式速查表，将 7 处 `query(...)` 调用改为 Kysely DSL。
移除所有 `as any[]` 类型断言。

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/lib/auth.ts
git commit -m "refactor: migrate auth.ts to Kysely"
```

---

## Task 3：迁移 lib 核心模块（user-level）

**文件：**
- 修改：`src/lib/user-level.ts`（18 处调用，含手动事务 + FOR UPDATE + IN 查询）

这是复杂文件，涉及：
- `getConnection()` + 手动事务 → `db.transaction().execute(async (trx) => { ... })`
- `FOR UPDATE` → `.forUpdate()`
- IN 查询动态占位符 → `.where("user_id", "in", userIds)`
- 多个 `COUNT(*)` 聚合查询

- [ ] **步骤 1：迁移 user-level.ts**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/user-level.ts
git commit -m "refactor: migrate user-level.ts to Kysely"
```

---

## Task 4：迁移 lib 核心模块（account-deletion — 最复杂）

**文件：**
- 修改：`src/lib/account-deletion.ts`（40 处调用，含 withTransaction + safeQuery）

涉及：
- `withTransaction()` → `db.transaction().execute(async (trx) => { ... })`
- 所有 `conn.execute(...)` 改为 `trx.xxx()` Kysely DSL
- `safeQuery(...)` → `safeExecute(() => db.xxx().execute(), default, "label")`
- 大量 DELETE 语句

- [ ] **步骤 1：迁移 account-deletion.ts**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/account-deletion.ts
git commit -m "refactor: migrate account-deletion.ts to Kysely"
```

---

## Task 5：迁移 lib 事务模块（payment + earnings）

**文件：**
- 修改：`src/lib/payment.ts`（8 处调用，含 withTransaction）
- 修改：`src/lib/earnings.ts`（22 处调用，含 withTransaction）

- [ ] **步骤 1：迁移 payment.ts**

`withTransaction()` → `db.transaction().execute()`，内部 conn.execute → trx Kysely DSL。

- [ ] **步骤 2：迁移 earnings.ts**

- [ ] **步骤 3：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 4：Commit**

```bash
git add src/lib/payment.ts src/lib/earnings.ts
git commit -m "refactor: migrate payment.ts + earnings.ts to Kysely"
```

---

## Task 6：迁移 lib 事务模块（private-message）

**文件：**
- 修改：`src/lib/private-message.ts`（18 处调用，含 withTransaction）

- [ ] **步骤 1：迁移 private-message.ts**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/private-message.ts
git commit -m "refactor: migrate private-message.ts to Kysely"
```

---

## Task 7：迁移 lib 中等复杂度模块（email + email-template + email-marketing）

**文件：**
- 修改：`src/lib/email.ts`（1 处调用）
- 修改：`src/lib/email-template.ts`（6 处调用）
- 修改：`src/lib/email-marketing.ts`（19 处调用）

- [ ] **步骤 1：迁移三个文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/email.ts src/lib/email-template.ts src/lib/email-marketing.ts
git commit -m "refactor: migrate email modules to Kysely"
```

---

## Task 8：迁移 lib 中等复杂度模块（ai-generate + ai-chat + nsfw）

**文件：**
- 修改：`src/lib/ai-generate.ts`（9 处调用）
- 修改：`src/lib/ai-chat.ts`（2 处调用）
- 修改：`src/lib/nsfw.ts`（6 处调用）

- [ ] **步骤 1：迁移三个文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/ai-generate.ts src/lib/ai-chat.ts src/lib/nsfw.ts
git commit -m "refactor: migrate AI + NSFW modules to Kysely"
```

---

## Task 9：迁移 lib 简单模块（batch 1）

**文件：**
- 修改：`src/lib/rate-limit.ts`（9 处调用）
- 修改：`src/lib/notification.ts`（4 处调用）
- 修改：`src/lib/creator-verification.ts`（12 处调用）
- 修改：`src/lib/bot-notification.ts`（6 处调用）
- 修改：`src/lib/audit-log.ts`（3 处调用）

- [ ] **步骤 1：迁移五个文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/rate-limit.ts src/lib/notification.ts src/lib/creator-verification.ts src/lib/bot-notification.ts src/lib/audit-log.ts
git commit -m "refactor: migrate rate-limit, notification, creator, bot, audit to Kysely"
```

---

## Task 10：迁移 lib 简单模块（batch 2）

**文件：**
- 修改：`src/lib/daily-wallpaper.ts`（1 处调用）
- 修改：`src/lib/webhook.ts`（4 处调用）
- 修改：`src/lib/watermark.ts`（2 处调用）
- 修改：`src/lib/storage-quota.ts`（2 处调用）
- 修改：`src/lib/tag-suggest.ts`（1 处调用，含 safeQuery）
- 修改：`src/lib/meilisearch.ts`（1 处调用）
- 修改：`src/lib/analytics.ts`（1 处调用）
- 修改：`src/lib/login-wallpapers.ts`（1 处调用）

- [ ] **步骤 1：迁移八个文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/daily-wallpaper.ts src/lib/webhook.ts src/lib/watermark.ts src/lib/storage-quota.ts src/lib/tag-suggest.ts src/lib/meilisearch.ts src/lib/analytics.ts src/lib/login-wallpapers.ts
git commit -m "refactor: migrate remaining simple lib modules to Kysely"
```

---

## Task 11：迁移 lib 特殊模块（feishu-ws-client）

**文件：**
- 修改：`src/lib/feishu-ws-client.ts`（3 处调用）

注意：此文件是 WebSocket 客户端，仅迁移数据库调用部分。

- [ ] **步骤 1：迁移 feishu-ws-client.ts**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/lib/feishu-ws-client.ts
git commit -m "refactor: migrate feishu-ws-client.ts to Kysely"
```

---

## Task 12：迁移页面文件（SSR pages）

**文件：**
- 修改：`src/app/profile/page.tsx`（3 处调用）
- 修改：`src/app/user/[id]/page.tsx`（7 处调用）
- 修改：`src/app/images/[id]/page.tsx`（1 处调用）
- 修改：`src/app/creator/[id]/page.tsx`（3 处调用）
- 修改：`src/app/sitemap.ts`（2 处调用）
- 修改：`src/app/embed/wallpaper/[imageId]/page.tsx`（1 处调用）
- 修改：`src/app/embed/daily/page.tsx`（1 处调用）

- [ ] **步骤 1：迁移七个页面文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/profile/page.tsx src/app/user/ src/app/images/ src/app/creator/ src/app/sitemap.ts src/app/embed/
git commit -m "refactor: migrate SSR pages to Kysely"
```

---

## Task 13：迁移 API 路由 — auth 域

**文件：**
- `src/app/api/auth/register/route.ts`（3 处，含 withTransaction）
- `src/app/api/auth/reset-password/route.ts`（3 处）
- `src/app/api/auth/forgot-password/route.ts`（3 处）
- `src/app/api/auth/profile/route.ts`（5 处）
- `src/app/api/auth/account-deletion/route.ts`（1 处）
- `src/app/api/auth/oauth-status/route.ts`（1 处）

- [ ] **步骤 1：迁移所有 auth 路由文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/auth/
git commit -m "refactor: migrate auth API routes to Kysely"
```

---

## Task 14：迁移 API 路由 — admin 域（大组）

**文件（28 个）：**
- `admin/analytics/route.ts`（15 处）
- `admin/logs/route.ts`（16 处）
- `admin/models/route.ts`（19 处）
- `admin/roles/route.ts`（11 处）
- `admin/crawl/route.ts`（6 处，588 行大文件）
- `admin/crawl/preview/route.ts`（10 处）
- `admin/crawl/import/route.ts`（5 处）
- `admin/crawl/review/route.ts`（6 处）
- `admin/crawl/schedule/route.ts`（5 处）
- `admin/crawl/events/route.ts`（2 处）
- `admin/membership/route.ts`（9 处，含 withTransaction）
- `admin/membership/redeem-codes/route.ts`（5 处，含 withTransaction）
- `admin/membership/redeem-codes/[id]/route.ts`（5 处）
- `admin/membership/check-expiring/route.ts`（3 处）
- `admin/orders/route.ts`（3 处，含 withTransaction）
- `admin/users/route.ts`（5 处，含 safeQuery）
- `admin/users/[id]/route.ts`（9 处）
- `admin/theme-zones/route.ts`（6 处）
- `admin/theme-zones/images/route.ts`（3 处）
- `admin/theme-zones/options/route.ts`（2 处）
- `admin/notifications/route.ts`（7 处）
- `admin/announcements/route.ts`（5 处）
- `admin/bots/route.ts`（5 处）
- `admin/bot-messages/route.ts`（2 处）
- `admin/menus/route.ts`（6 处）
- `admin/api-usage/route.ts`（6 处）
- `admin/duplicates/route.ts`（2 处）
- `admin/export/route.ts`（3 处）
- `admin/generate-variants/route.ts`（6 处）
- `admin/review/route.ts`（5 处）
- `admin/search-sync/route.ts`（3 处）
- `admin/email-templates/route.ts`（1 处）
- `admin/email-marketing/campaigns/route.ts`（1 处）
- `admin/settings/route.ts`（1 处）
- `admin/paid-wallpapers/route.ts`（1 处）
- `admin/stats/route.ts`（检查是否有 SQL 调用）

- [ ] **步骤 1：迁移 admin 路由文件（按子域分批）**

建议内部子顺序：settings/小文件 → notifications → bots → crawl → theme-zones → membership → users → analytics/logs/models/roles

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/admin/
git commit -m "refactor: migrate admin API routes to Kysely"
```

---

## Task 15：迁移 API 路由 — images 域

**文件（12 个）：**
- `api/images/route.ts`（4 处）
- `api/images/[id]/route.ts`（8 处）
- `api/images/[id]/download/route.ts`（4 处）
- `api/images/[id]/comments/route.ts`（10 处）
- `api/images/[id]/similar/route.ts`（3 处）
- `api/images/[id]/extract-color/route.ts`（2 处）
- `api/images/[id]/paid-status/route.ts`（3 处）
- `api/images/[id]/resize/route.ts`（2 处）
- `api/images/batch-delete/route.ts`（2 处）
- `api/images/check-duplicate/route.ts`（1 处）
- `api/images/search/facets/route.ts`（1 处）
- `api/images/search/color/route.ts`（1 处）

- [ ] **步骤 1：迁移所有 images 路由文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/images/
git commit -m "refactor: migrate images API routes to Kysely"
```

---

## Task 16：迁移 API 路由 — collections + favorites 域

**文件（6 个）：**
- `api/collections/route.ts`（5 处）
- `api/collections/[id]/route.ts`（7 处）
- `api/collections/[id]/images/route.ts`（12 处）
- `api/collections/[id]/subscribe/route.ts`（4 处）
- `api/favorites/route.ts`（2 处）
- `api/favorites/[imageId]/route.ts`（4 处）

- [ ] **步骤 1：迁移所有文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/collections/ src/app/api/favorites/
git commit -m "refactor: migrate collections + favorites API routes to Kysely"
```

---

## Task 17：迁移 API 路由 — feed + posts + comments 域

**文件（7 个）：**
- `api/feed/route.ts`（12 处）
- `api/posts/route.ts`（15 处）
- `api/posts/[id]/route.ts`（12 处）
- `api/posts/[id]/like/route.ts`（6 处）
- `api/posts/[id]/comments/route.ts`（8 处）
- `api/comments/[id]/route.ts`（3 处）
- `api/comments/[id]/like/route.ts`（2 处）

- [ ] **步骤 1：迁移所有文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/feed/ src/app/api/posts/ src/app/api/comments/
git commit -m "refactor: migrate feed + posts + comments API routes to Kysely"
```

---

## Task 18：迁移 API 路由 — user 域 + orders 域

**文件（11 个）：**
- `api/users/[id]/follow/route.ts`（7 处）
- `api/users/[id]/profile/route.ts`（4 处）
- `api/user/uploads/route.ts`（6 处）
- `api/user/downloads/route.ts`（2 处）
- `api/user/usage/route.ts`（5 处）
- `api/user/follow-stats/route.ts`（2 处）
- `api/user/profile-customization/route.ts`（4 处）
- `api/user/membership/route.ts`（1 处）
- `api/user/redeem-membership/route.ts`（10 处，含 withTransaction）
- `api/orders/route.ts`（5 处，含 withTransaction）
- `api/orders/[id]/route.ts`（1 处）

- [ ] **步骤 1：迁移所有文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/users/ src/app/api/user/ src/app/api/orders/
git commit -m "refactor: migrate user + orders API routes to Kysely"
```

---

## Task 19：迁移 API 路由 — discover + challenges 域

**文件（8 个）：**
- `api/discover/theme-zones/route.ts`（6 处）
- `api/discover/theme-zone-detail/route.ts`（5 处）
- `api/discover/fresh-picks/route.ts`（3 处）
- `api/discover/featured-carousel/route.ts`（5 处）
- `api/challenges/route.ts`（5 处）
- `api/challenges/[id]/route.ts`（7 处）
- `api/challenges/[id]/vote/route.ts`（5 处）
- `api/challenges/[id]/submit/route.ts`（5 处）

- [ ] **步骤 1：迁移所有文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/discover/ src/app/api/challenges/
git commit -m "refactor: migrate discover + challenges API routes to Kysely"
```

---

## Task 20：迁移 API 路由 — 剩余杂项

**文件（~25 个）：**
- `api/ai-generate/route.ts`（6 处）
- `api/api-keys/route.ts`（3 处）
- `api/api-keys/[id]/route.ts`（6 处）
- `api/announcements/route.ts`（1 处）
- `api/blog/route.ts`（2 处）
- `api/categories/route.ts`（10 处）
- `api/daily-wallpaper/personal/route.ts`（5 处）
- `api/download/batch/route.ts`（2 处）
- `api/email-marketing/track/route.ts`（4 处）
- `api/embed/route.ts`（5 处）
- `api/feedback/route.ts`（1 处）
- `api/health/route.ts`（1 处）
- `api/logs/route.ts`（3 处）
- `api/messages/route.ts`（1 处）
- `api/notifications/route.ts`（5 处）
- `api/notifications/[id]/route.ts`（2 处）
- `api/notifications/settings/route.ts`（5 处）
- `api/rankings/route.ts`（2 处）
- `api/recommendations/route.ts`（4 处）
- `api/reports/route.ts`（8 处）
- `api/search/suggest/route.ts`（3 处）
- `api/search/hot/route.ts`（1 处）
- `api/search/facets/route.ts`（1 处）
- `api/tags/route.ts`（2 处）
- `api/upload/route.ts`（10 处）
- `api/upload/batch/route.ts`（4 处）
- `api/webhooks/route.ts`（6 处）
- `api/v1/wallpapers/route.ts`（2 处）
- `api/v1/wallpapers/[id]/route.ts`（2 处）
- `api/v1/wallpapers/[id]/download/route.ts`（2 处）
- `api/v1/rankings/route.ts`（2 处）
- `api/v1/collections/route.ts`（2 处）
- `api/v1/categories/route.ts`（1 处）
- `api/earnings/route.ts`（检查）
- `api/editor/export/route.ts`（检查）

- [ ] **步骤 1：迁移所有剩余 API 路由文件**

- [ ] **步骤 2：验证**

运行：`npx tsc --noEmit`

- [ ] **步骤 3：Commit**

```bash
git add src/app/api/
git commit -m "refactor: migrate remaining API routes to Kysely"
```

---

## Task 21：清理 + 全量验证

**文件：**
- 修改：`src/lib/db.ts`（删除 query/safeQuery/getConnection + pool 导出）
- 修改：`src/lib/db-tx.ts`（删除 withTransaction 兼容函数）

- [ ] **步骤 1：清理 db.ts**

从 `src/lib/db.ts` 中删除：
- `query()` 函数
- `safeQuery()` 函数
- `getConnection()` 函数
- `export default pool`
- `RETRYABLE_ERRORS` 常量（移到插件内部或保留为模块级常量）

最终 db.ts 仅包含：pool 创建、retryPlugin、`db` 实例导出、`safeExecute()` 函数。

- [ ] **步骤 2：清理 db-tx.ts**

从 `src/lib/db-tx.ts` 中删除旧的 `withTransaction()` 函数和 `import pool, { getConnection } from "@/lib/db"` 兼容导入。
仅保留 `withTransactionSafe()`。

- [ ] **步骤 3：全量 grep 确认无残留**

```bash
rg "await (query|safeQuery)\(" src/ --type ts
rg "getConnection\(\)" src/ --type ts
rg "withTransaction\(" src/ --type ts
rg "as any\[\]" src/lib src/app --type ts
```

预期：所有命令返回 0 结果（或仅有注释/文档中的引用）。

- [ ] **步骤 4：全量类型检查**

运行：`npx tsc --noEmit`
预期：无错误

- [ ] **步骤 5：运行测试**

运行：`vitest run`
预期：所有测试通过

- [ ] **步骤 6：构建验证**

运行：`pnpm build`
预期：构建成功

- [ ] **步骤 7：最终 Commit**

```bash
git add -A
git commit -m "refactor: remove legacy query helpers, complete Kysely migration"
```

---

## 验证清单

迁移完成后确认：

- [ ] `rg "from.*@/lib/db.*query" src/` — 无结果
- [ ] `rg "safeQuery" src/` — 无结果
- [ ] `rg "getConnection\(\)" src/` — 无结果
- [ ] `rg "withTransaction\b" src/` — 仅有 `withTransactionSafe`
- [ ] `rg "as any\[\]" src/lib src/app` — 无结果（或极少残留）
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `vitest run` — all pass
- [ ] `pnpm build` — success
