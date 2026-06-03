# Kysely Query Builder 集成设计

## 背景

项目当前有 **776 处 SQL 调用**，分布在 ~130 个文件中（47 个 lib + 100+ API route），全部使用 mysql2 原生 SQL 字符串。

现有 `src/lib/db.ts` 提供 `query()` / `safeQuery()` / `getConnection()` 三个核心函数，已内置连接重试逻辑。`src/lib/db-tx.ts` 提供事务辅助。

### 痛点

1. **无类型安全**：所有查询结果都需要 `as any[]` 断言，表名/列名无自动补全，拼写错误只能在运行时发现
2. **SQL 维护负担**：776 处手写 SQL 字符串，修改表结构时需全局搜索替换
3. **代码一致性**：连接管理、事务处理模式不统一，部分文件手动 `getConnection()` + `release()`

## 决策

- **工具**：Kysely（轻量级类型安全 SQL query builder）
- **方案**：薄封装（Thin Wrapper）— 直接暴露 Kysely `db` 实例，所有调用点改为 Kysely DSL
- **迁移策略**：一次性全量迁移 776 处 SQL 调用
- **Schema 管理**：仅查询层，表结构仍用 SQL 迁移脚本管理
- **类型生成**：使用 kysely-codegen 从数据库自动推断

## 架构

### 新增依赖

```
kysely         — query builder 核心
kysely-codegen — 从数据库自动生成 TypeScript 类型（devDependency）
```

### 文件变更清单

| 文件 | 变更 |
|------|------|
| `package.json` | 新增 `kysely`（dependencies）、`kysely-codegen`（devDependencies） |
| `src/lib/db.ts` | 重构：导出 Kysely `db` 实例 + `safeExecute()` + 重试插件 |
| `src/lib/db-types.ts` | **新增**：kysely-codegen 自动生成的 Database 类型 |
| `src/lib/db-tx.ts` | 简化：仅保留 `withTransactionSafe()` |
| `scripts/generate-db-types.ts` | **新增**：类型生成脚本 |
| ~130 个使用 `query()`/`safeQuery()` 的文件 | 逐一迁移为 Kysely DSL |

## 详细设计

### 1. 核心基础设施（db.ts 改造）

```ts
import { Kysely, MysqlDialect, type KyselyPlugin } from "kysely";
import mysql from "mysql2/promise";
import type { Database } from "./db-types";

// 连接池配置与现有完全一致
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

// 可重试的连接错误码（与现有逻辑一致）
const RETRYABLE_ERRORS = ["ETIMEDOUT", "ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE"];

// 重试插件 — 拦截连接类错误自动重试一次
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
    // 不可达，但 TypeScript 需要
    throw new Error("Retry logic exhausted unexpectedly");
  },
};

// Kysely 实例 — 类型安全的查询入口
export const db = new Kysely<Database>({
  dialect: new MysqlDialect({ pool: pool.pool }),
  plugins: [retryPlugin],
});

// 安全执行辅助函数 — 替代现有 safeQuery
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
```

### 2. 类型系统（db-types.ts）

由 `kysely-codegen` 从数据库自动推断，运行命令：

```bash
npx kysely-codegen --dialect mysql \
  --connection-string "mysql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" \
  --out-file src/lib/db-types.ts
```

生成结果示例：

```ts
import type { ColumnType, Generated } from "kysely";

export interface Database {
  users: {
    id: Generated<number>;
    name: string;
    email: string;
    password_hash: string | null;
    // ... 所有字段
  };
  images: {
    id: Generated<number>;
    // ...
  };
  // ... 所有表
}
```

添加 npm script 方便后续更新：

```json
{
  "scripts": {
    "db:types": "kysely-codegen --dialect mysql --connection-string \"mysql://...\" --out-file src/lib/db-types.ts"
  }
}
```

### 3. 查询迁移模式

#### 基础 CRUD

| 现有模式 | Kysely DSL |
|---------|-----------|
| `query("SELECT * FROM users WHERE id = ?", [id])` | `db.selectFrom("users").where("id", "=", id).selectAll().execute()` |
| `query("INSERT INTO users (name, email) VALUES (?, ?)", [name, email])` | `db.insertInto("users").values({ name, email }).execute()` |
| `query("UPDATE users SET name = ? WHERE id = ?", [name, id])` | `db.updateTable("users").set({ name }).where("id", "=", id).execute()` |
| `query("DELETE FROM favorites WHERE user_id = ?", [userId])` | `db.deleteFrom("favorites").where("user_id", "=", userId).execute()` |

#### 聚合查询

```ts
// Before
const uploadRows = await query(
  "SELECT COUNT(*) as count FROM images WHERE uploaded_by = ?",
  [userId]
) as any[];
const uploadCount = uploadRows[0]?.count || 0;

// After
const result = await db
  .selectFrom("images")
  .select((eb) => eb.fn.countAll().as("count"))
  .where("uploaded_by", "=", userId)
  .executeTakeFirst();
const uploadCount = Number(result?.count ?? 0);
```

#### JOIN 查询

```ts
// Before
const favoriteRows = await query(
  `SELECT COUNT(*) as count FROM favorites f
   INNER JOIN images i ON f.image_id = i.id
   WHERE i.uploaded_by = ?`,
  [userId]
) as any[];

// After
const result = await db
  .selectFrom("favorites")
  .innerJoin("images", "favorites.image_id", "images.id")
  .select((eb) => eb.fn.countAll().as("count"))
  .where("images.uploaded_by", "=", userId)
  .executeTakeFirst();
```

#### IN 查询（动态占位符）

```ts
// Before — 手动拼接占位符
const placeholders = userIds.map(() => "?").join(",");
const rows = await query(
  `SELECT * FROM user_levels WHERE user_id IN (${placeholders})`,
  userIds
) as any[];

// After — Kysely 自动处理
const rows = await db
  .selectFrom("user_levels")
  .where("user_id", "in", userIds)
  .selectAll()
  .execute();
// rows 类型为 user_levels[]，无需 as any[]
```

#### safeQuery 替代

```ts
// Before
const rows = await safeQuery("SELECT ...", [params], defaultValue);

// After
const rows = await safeExecute(
  () => db.selectFrom("...").where(...).selectAll().execute(),
  defaultValue,
  "getDescription"
);
```

### 4. 事务处理

#### 手动连接管理 → Kysely 事务 API

```ts
// Before — 手动 getConnection / beginTransaction / commit / rollback / release
const conn = await getConnection();
try {
  await conn.beginTransaction();
  const [rows] = await conn.execute(
    "SELECT id, exp FROM user_levels WHERE user_id = ? FOR UPDATE",
    [userId]
  );
  let currentExp = rows.length === 0 ? 0 : rows[0].exp;
  if (rows.length === 0) {
    await conn.execute(
      "INSERT INTO user_levels (user_id, level, exp, title) VALUES (?, 1, 0, '新手')",
      [userId]
    );
  }
  const newExp = currentExp + amount;
  await conn.execute(
    "UPDATE user_levels SET exp = ?, level = ?, title = ? WHERE user_id = ?",
    [newExp, levelInfo.level, levelInfo.title, userId]
  );
  await conn.commit();
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  conn.release();
}

// After — Kysely 事务
await db.transaction().execute(async (trx) => {
  const row = await trx
    .selectFrom("user_levels")
    .select(["id", "exp"])
    .where("user_id", "=", userId)
    .forUpdate()
    .executeTakeFirst();

  let currentExp = row?.exp ?? 0;
  if (!row) {
    await trx
      .insertInto("user_levels")
      .values({ user_id: userId, level: 1, exp: 0, title: "新手" })
      .execute();
  }

  const newExp = currentExp + amount;
  const levelInfo = calculateLevel(newExp);
  await trx
    .updateTable("user_levels")
    .set({ exp: newExp, level: levelInfo.level, title: levelInfo.title })
    .where("user_id", "=", userId)
    .execute();
});
// 自动 commit/rollback/release
```

#### db-tx.ts 简化

迁移后 `db-tx.ts` 仅保留安全事务包装：

```ts
import { db, type Database } from "@/lib/db";
import type { Transaction } from "kysely";

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
```

### 5. 错误处理与容错

- **重试逻辑**：通过 Kysely 插件实现，行为与现有 `query()` 完全一致（连接类错误自动重试一次）
- **容错降级**：`safeExecute()` 函数替代 `safeQuery()`，失败时返回默认值
- **连接池配置**：零改动，Kysely 的 `MysqlDialect` 直接复用 mysql2 连接池
- **日志**：重试和降级日志格式与现有保持一致

### 6. 迁移完成后的清理

- 删除 `query()` / `safeQuery()` / `getConnection()` 函数
- 删除 `pool` 的直接导出（仅 Kysely dialect 内部使用）
- `db-tx.ts` 简化为仅 `withTransactionSafe()`
- 从 `db.ts` 移除 `RETRYABLE_ERRORS` 常量（已内联到插件中）

## 迁移执行计划

### 批次 1：基础设施搭建
- 安装 `kysely` + `kysely-codegen`
- 运行 kysely-codegen 生成 `db-types.ts`
- 改造 `db.ts`（导出 `db` 实例，保留旧函数兼容）
- 简化 `db-tx.ts`

### 批次 2：核心 lib 文件（47 个文件，~250 处调用）
- 按模块逐个迁移：auth → user-level → account-deletion → payment → ...
- 每改完一个文件运行 `npx tsc --noEmit` 验证

### 批次 3：API route 文件（100+ 文件，~500 处调用）
- 按功能域迁移：admin → auth → images → collections → feed → ...

### 批次 4：清理与验证
- 删除 `query()` / `safeQuery()` / `getConnection()` 及相关死代码
- 全量 `npx tsc --noEmit`
- 全量 `vitest run`
- `pnpm build` 确认项目编译通过

## 测试策略

- 迁移期间：每批文件改完后 `npx tsc --noEmit` 验证类型
- 迁移后：`vitest run` 确保现有测试通过
- 回归验证：`pnpm build` 确认整个项目编译通过
- 不新增单元测试（本次为重构，现有测试即为回归测试）

## 风险缓解

- 连接池配置零改动，Kysely 复用 mysql2 的 pool
- 重试逻辑通过 Kysely 插件保留，行为与现有一致
- 迁移期间新旧代码共存（`query()` 和 `db` 同时可用），不存在中间态不可用的风险
- 类型生成与现有表结构对齐，不需要修改数据库

## 不做的事情

- 不引入 ORM（Prisma、TypeORM 等）
- 不改变数据库 Schema 管理方式（继续用 SQL 迁移脚本）
- 不引入 Repository 层（如未来需要可从方案 A 自然演进到方案 C）
- 不新增测试文件
