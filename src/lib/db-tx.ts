/**
 * 数据库事务工具库
 * 
 * 提供事务执行辅助函数，确保关键操作的数据一致性
 * 核心理念：将多个相关的数据库操作包装在事务中，
 * 任一步骤失败则全部回滚
 */

import pool, { getConnection } from "@/lib/db";

/**
 * 在事务中执行操作
 * 自动获取连接、开启事务、提交/回滚
 * 
 * @param fn 事务内执行的函数，接收连接对象
 * @returns fn 的返回值
 * @throws fn 抛出的错误（事务已回滚）
 * 
 * @example
 * ```ts
 * const result = await withTransaction(async (conn) => {
 *   const [r1] = await conn.execute("INSERT INTO ...", [...]);
 *   const [r2] = await conn.execute("UPDATE ...", [...]);
 *   return r1;
 * });
 * ```
 */
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

/**
 * 在事务中执行操作（安全模式）
 * 失败时不抛出异常，而是返回 null 和错误信息
 */
export async function withTransactionSafe<T>(
  fn: (conn: any) => Promise<T>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const result = await withTransaction(fn);
    return { data: result, error: null };
  } catch (error: any) {
    console.error("[Transaction] 事务执行失败:", error);
    return { data: null, error: error.message || "事务执行失败" };
  }
}