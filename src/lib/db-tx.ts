/**
 * 数据库事务工具库
 *
 * 提供事务执行辅助函数，确保关键操作的数据一致性
 * 迁移到 Kysely 后，推荐使用 db.transaction().execute() 原生事务
 */

import { db } from "@/lib/db";
import type { DB } from "@/lib/db-types";
import type { Transaction } from "kysely";

/**
 * 安全事务包装 — 失败时不抛异常，返回 { data, error }
 * Kysely 原生事务版本
 */
export async function withTransactionSafe<T>(
  fn: (trx: Transaction<DB>) => Promise<T>
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
