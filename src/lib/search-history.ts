/**
 * 搜索历史管理（localStorage）
 */

const SEARCH_HISTORY_KEY = "search_history";
const MAX_HISTORY = 20;

export function getSearchHistory(): string[] {
  if (typeof globalThis.localStorage === "undefined") return [];
  try {
    const raw = globalThis.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const history: string[] = JSON.parse(raw);
    return Array.isArray(history) ? history.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(keyword: string): void {
  if (!keyword.trim()) return;
  const history = getSearchHistory();
  // 去重：移除已存在的相同关键词
  const filtered = history.filter((h) => h !== keyword.trim());
  // 新关键词放在最前面
  filtered.unshift(keyword.trim());
  // 限制最大数量
  if (filtered.length > MAX_HISTORY) {
    filtered.length = MAX_HISTORY;
  }
  try {
    globalThis.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage 满了，忽略
  }
}

export function removeSearchHistory(keyword: string): void {
  const history = getSearchHistory();
  const filtered = history.filter((h) => h !== keyword);
  try {
    globalThis.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch {}
}

export function clearSearchHistory(): void {
  try {
    globalThis.localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {}
}
