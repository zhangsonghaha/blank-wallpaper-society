import { Meilisearch, Index } from "meilisearch";
import { query } from "@/lib/db";

// ==================== 配置 ====================

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || "http://localhost:7700";
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY || "";
const INDEX_NAME = "wallpapers";

// ==================== 类型定义 ====================

export interface ImageSearchData {
  id: number;
  title: string;
  description: string;
  tags: string;
  category: string;
  author: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  dominant_color: string;
  color_palette: string[];
  view_count: number;
  download_count: number;
  favorite_count: number;
  media_type: string;
  status: string;
  created_at: string;
}

export interface SearchOptions {
  category?: string;
  color?: string;
  status?: string;
  media_type?: string;
  sort?: "newest" | "popular" | "downloads";
  page?: number;
  limit?: number;
}

export interface SearchResult {
  data: ImageSearchData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== 客户端单例 ====================

let clientInstance: Meilisearch | null = null;
let clientAvailable: boolean | null = null;

/**
 * 获取 Meilisearch 客户端实例
 */
export function getMeilisearchClient(): Meilisearch | null {
  if (clientInstance) return clientInstance;

  try {
    clientInstance = new Meilisearch({
      host: MEILISEARCH_HOST,
      apiKey: MEILISEARCH_API_KEY,
    });
    return clientInstance;
  } catch (error) {
    console.warn("Meilisearch 客户端初始化失败:", error);
    return null;
  }
}

/**
 * 检查 Meilisearch 是否可用
 */
export async function isMeilisearchAvailable(): Promise<boolean> {
  if (clientAvailable !== null) return clientAvailable;

  try {
    const client = getMeilisearchClient();
    if (!client) {
      clientAvailable = false;
      return false;
    }
    await client.health();
    clientAvailable = true;
    return true;
  } catch {
    clientAvailable = false;
    return false;
  }
}

/**
 * 获取 wallpapers index
 */
export function getWallpapersIndex(): Index | null {
  const client = getMeilisearchClient();
  if (!client) return null;
  return client.index(INDEX_NAME);
}

// ==================== 索引配置 ====================

/**
 * 初始化索引配置（首次使用时调用）
 */
export async function ensureIndexConfig(): Promise<boolean> {
  try {
    const client = getMeilisearchClient();
    if (!client) return false;

    const index = client.index(INDEX_NAME);

    // 更新可搜索属性
    await index.updateSearchableAttributes([
      "title",
      "tags",
      "category",
      "author",
      "description",
    ]);

    // 更新可过滤属性
    await index.updateFilterableAttributes([
      "category",
      "status",
      "media_type",
      "dominant_color",
    ]);

    // 更新可排序属性
    await index.updateSortableAttributes([
      "created_at",
      "download_count",
      "view_count",
    ]);

    // 更新排序规则
    await index.updateRankingRules([
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
    ]);

    return true;
  } catch (error) {
    console.error("Meilisearch 索引配置失败:", error);
    return false;
  }
}

// ==================== 数据转换 ====================

/**
 * 将数据库行转换为搜索数据
 */
export function dbRowToSearchData(row: any): ImageSearchData {
  let colorPalette: string[] = [];
  if (row.color_palette) {
    try {
      colorPalette = JSON.parse(row.color_palette);
    } catch {
      colorPalette = [];
    }
  }

  return {
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    tags: row.tags || "",
    category: row.category || "",
    author: row.author || "",
    url: row.url || "",
    thumbnail_url: row.thumbnail_url || "",
    width: row.width || 0,
    height: row.height || 0,
    dominant_color: row.dominant_color || "",
    color_palette: colorPalette,
    view_count: row.view_count || 0,
    download_count: row.download_count || 0,
    favorite_count: row.favorite_count || 0,
    media_type: row.media_type || "image",
    status: row.status || "approved",
    created_at: row.created_at || "",
  };
}

// ==================== 索引操作 ====================

/**
 * 索引单张图片（异步，不阻塞主操作）
 */
export async function indexImage(image: ImageSearchData): Promise<void> {
  try {
    const index = getWallpapersIndex();
    if (!index) return;
    await index.addDocuments([image], { primaryKey: "id" });
  } catch (error) {
    console.warn("Meilisearch 索引单张图片失败:", error);
  }
}

/**
 * 批量索引图片
 */
export async function indexImages(images: ImageSearchData[]): Promise<void> {
  try {
    const index = getWallpapersIndex();
    if (!index) return;
    const batchSize = 1000;
    if (images.length <= batchSize) {
      await index.addDocuments(images, { primaryKey: "id" });
    } else {
      // 使用 addDocumentsInBatches
      const client = getMeilisearchClient();
      if (!client) return;
      const batchResponse = await client
        .index(INDEX_NAME)
        .addDocumentsInBatches(images, batchSize, { primaryKey: "id" });
      // 等待所有批次完成
      for (const task of batchResponse) {
        const enqueued = await task;
        await client.tasks.waitForTask(enqueued.taskUid);
      }
    }
  } catch (error) {
    console.warn("Meilisearch 批量索引失败:", error);
  }
}

/**
 * 删除图片索引
 */
export async function deleteImage(id: number): Promise<void> {
  try {
    const index = getWallpapersIndex();
    if (!index) return;
    await index.deleteDocument(id);
  } catch (error) {
    console.warn("Meilisearch 删除索引失败:", error);
  }
}

// ==================== 搜索 ====================

/**
 * 搜索壁纸
 */
export async function searchWallpapers(
  q: string,
  options?: SearchOptions
): Promise<SearchResult | null> {
  try {
    const index = getWallpapersIndex();
    if (!index) return null;

    const page = options?.page || 1;
    const limit = options?.limit || 24;
    const offset = (page - 1) * limit;

    // 构建过滤条件
    const filters: string[] = [];
    filters.push('status = "approved"');

    if (options?.category && options.category !== "all") {
      filters.push(`category = "${options.category}"`);
    }
    if (options?.media_type) {
      filters.push(`media_type = "${options.media_type}"`);
    }
    if (options?.color) {
      filters.push(`dominant_color = "${options.color}"`);
    }

    // 构建排序
    let sort: string[] | undefined;
    if (options?.sort === "newest") {
      sort = ["created_at:desc"];
    } else if (options?.sort === "popular") {
      sort = ["view_count:desc"];
    } else if (options?.sort === "downloads") {
      sort = ["download_count:desc"];
    }

    const searchResult = await index.search(q, {
      filter: filters,
      sort,
      offset,
      limit,
      attributesToRetrieve: [
        "id",
        "title",
        "description",
        "tags",
        "category",
        "author",
        "url",
        "thumbnail_url",
        "width",
        "height",
        "dominant_color",
        "color_palette",
        "view_count",
        "download_count",
        "favorite_count",
        "media_type",
        "created_at",
      ],
    });

    return {
      data: searchResult.hits as ImageSearchData[],
      total: searchResult.estimatedTotalHits || 0,
      page,
      limit,
      totalPages: Math.ceil(
        (searchResult.estimatedTotalHits || 0) / limit
      ),
    };
  } catch (error) {
    console.warn("Meilisearch 搜索失败:", error);
    return null;
  }
}

/**
 * 获取搜索建议
 */
export async function searchSuggestions(
  q: string
): Promise<{ suggestions: { type: string; text: string }[] } | null> {
  try {
    const index = getWallpapersIndex();
    if (!index) return null;

    // 搜索标题和标签
    const result = await index.search(q, {
      limit: 8,
      attributesToRetrieve: ["title", "tags", "category"],
      attributesToSearchOn: ["title", "tags", "category"],
    });

    const suggestions: { type: string; text: string }[] = [];
    const seen = new Set<string>();

    for (const hit of result.hits as any[]) {
      // 标题建议
      if (hit.title && !seen.has(hit.title)) {
        suggestions.push({ type: "title", text: hit.title });
        seen.add(hit.title);
      }
      // 分类建议
      if (hit.category && !seen.has(hit.category)) {
        suggestions.push({ type: "category", text: hit.category });
        seen.add(hit.category);
      }
      // 标签建议
      if (hit.tags) {
        const tagList =
          typeof hit.tags === "string"
            ? hit.tags.split(",").map((t: string) => t.trim())
            : hit.tags;
        for (const tag of tagList) {
          if (
            tag &&
            tag.toLowerCase().includes(q.toLowerCase()) &&
            !seen.has(tag)
          ) {
            suggestions.push({ type: "tag", text: tag });
            seen.add(tag);
          }
        }
      }
    }

    return { suggestions: suggestions.slice(0, 8) };
  } catch (error) {
    console.warn("Meilisearch 搜索建议失败:", error);
    return null;
  }
}

/**
 * 获取索引统计信息
 */
export async function getIndexStats(): Promise<{
  numberOfDocuments: number;
  isIndexing: boolean;
  lastUpdate: string;
} | null> {
  try {
    const client = getMeilisearchClient();
    if (!client) return null;

    const indexStats = await client.index(INDEX_NAME).getStats();
    const globalStats = await client.getStats();
    return {
      numberOfDocuments: indexStats.numberOfDocuments,
      isIndexing: indexStats.isIndexing,
      lastUpdate: globalStats.lastUpdate || "",
    };
  } catch (error) {
    console.warn("Meilisearch 获取索引统计失败:", error);
    return null;
  }
}