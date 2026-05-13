"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PinCard from "./PinCard";
import FilterChips from "./FilterChips";
import Lightbox from "./Lightbox";
import { useSearch } from "@/context/SearchContext";

interface ImageRecord {
  id: number;
  title: string;
  description: string;
  filename: string;
  storage_key: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  author: string;
  tags: string;
  category: string;
  is_favorite: number;
  view_count: number;
  created_at: string;
}

interface CategoryRecord {
  id: number;
  name: string;
  slug: string;
}

const ITEMS_PER_PAGE = 12;

export default function MasonryGrid() {
  const { searchQuery, setSearchQuery, activeCategory, setActiveCategory, setFavoriteCount } =
    useSearch();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [totalCount, setTotalCount] = useState(0);

  // 加载分类
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data || []))
      .catch(() => {});
  }, []);

  // 加载图片
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (searchQuery.trim()) params.set("search", searchQuery);
    params.set("limit", "100"); // 加载较多数据用于客户端分页

    fetch(`/api/images?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.data || []);
        setTotalCount(data.total || 0);
        setVisibleCount(ITEMS_PER_PAGE);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeCategory, searchQuery]);

  // 同步收藏数量到 Context
  useEffect(() => {
    setFavoriteCount(favorites.size);
  }, [favorites.size, setFavoriteCount]);

  // 分页
  const displayedImages = useMemo(() => {
    return images.slice(0, visibleCount);
  }, [images, visibleCount]);

  const hasMore = visibleCount < images.length;

  // 收藏切换
  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 同步到服务器
    const isFav = !favorites.has(id);
    fetch(`/api/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: isFav ? 1 : 0 }),
    }).catch(() => {});
  }, [favorites]);

  // 灯箱导航
  const openLightbox = useCallback(
    (index: number) => {
      setLightboxIndex(index);
      setLightboxOpen(true);
    },
    []
  );

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const goToPrev = useCallback(
    () =>
      setLightboxIndex((prev) =>
        prev === 0 ? images.length - 1 : prev - 1
      ),
    [images.length]
  );
  const goToNext = useCallback(
    () =>
      setLightboxIndex((prev) =>
        prev === images.length - 1 ? 0 : prev + 1
      ),
    [images.length]
  );

  // 加载更多
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore]);

  // 无限滚动
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  // 分列
  const columns = useMemo(() => {
    const cols: ImageRecord[][] = [[], [], [], []];
    displayedImages.forEach((img, index) => {
      cols[index % 4].push(img);
    });
    return cols;
  }, [displayedImages]);

  // 转换为 GalleryImage 格式供 Lightbox 使用
  const lightboxImages = useMemo(
    () =>
      images.map((img) => ({
        id: img.id,
        src: img.url,
        width: img.width || 600,
        height: img.height || 800,
        title: img.title,
        description: img.description,
        tags: img.tags ? img.tags.split(",").map((t) => t.trim()) : [],
        author: img.author || "未知",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${img.author || img.id}`,
      })),
    [images]
  );

  return (
    <>
      {/* 搜索栏（移动端） */}
      <div className="sm:hidden px-4 pt-3 pb-2 bg-[var(--color-surface-soft)]">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ash)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索图片、灵感..."
            className="w-full h-11 pl-11 pr-10 bg-[var(--color-surface-card)] text-[var(--color-ink)] text-sm rounded-full placeholder:text-[var(--color-ash)] focus:outline-none focus:bg-[var(--color-canvas)] focus:ring-2 focus:ring-[var(--color-focus-outer)] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-ash)] hover:text-[var(--color-ink)]"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <FilterChips
        activeCategory={activeCategory}
        onCategoryChange={(cat) => {
          setActiveCategory(cat);
          setVisibleCount(ITEMS_PER_PAGE);
        }}
      />

      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-[44px] md:text-[70px] font-semibold leading-[1.1] tracking-[-1.2px] text-[var(--color-ink)]">
            发现视觉灵感
          </h1>
          <p className="mt-4 text-base md:text-lg text-[var(--color-mute)] max-w-2xl mx-auto leading-relaxed">
            探索精选摄影作品，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感
          </p>

          {/* 搜索状态提示 */}
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-card)] rounded-full text-sm"
            >
              <svg className="w-4 h-4 text-[var(--color-mute)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>
                搜索 &ldquo;{searchQuery}&rdquo; 共找到{" "}
                <strong>{totalCount}</strong> 张图片
              </span>
              <button
                onClick={() => setSearchQuery("")}
                className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--color-secondary-bg)] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}

          {/* 收藏统计 */}
          {favorites.size > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm font-medium rounded-full"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              已收藏 {favorites.size} 张
            </motion.div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((col) => (
              <div key={col} className="flex-1 flex flex-col gap-4">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="rounded-[var(--radius-md)] skeleton-pulse bg-[var(--color-surface-card)]"
                    style={{ aspectRatio: `${3 + (row % 3) * 0.5}/4` }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : displayedImages.length > 0 ? (
          <motion.div
            key={activeCategory + searchQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex gap-2 sm:gap-3 md:gap-4">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col gap-4">
                  {col.map((image, index) => {
                    const globalIdx = displayedImages.findIndex(
                      (img) => img.id === image.id
                    );
                    return (
                      <PinCard
                        key={image.id}
                        image={{
                          id: image.id,
                          src: image.thumbnail_url || image.url,
                          width: image.width || 600,
                          height: image.height || 800,
                          title: image.title,
                          description: image.description,
                          tags: image.tags
                            ? image.tags.split(",").map((t) => t.trim())
                            : [],
                          author: image.author || "未知",
                          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${image.author || image.id}`,
                        }}
                        index={globalIdx}
                        isFavorited={favorites.has(image.id)}
                        onToggleFavorite={toggleFavorite}
                        onClick={() => openLightbox(globalIdx)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--color-ash)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-ink)] mb-2">
              {searchQuery ? "没有找到匹配的图片" : "还没有图片"}
            </h3>
            <p className="text-[var(--color-mute)] mb-6">
              {searchQuery
                ? "试试其他关键词或清除搜索条件"
                : "去管理后台上传第一张图片吧"}
            </p>
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors active:scale-95"
              >
                清除搜索
              </button>
            ) : (
              <a
                href="/admin"
                className="inline-block px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors"
              >
                去上传
              </a>
            )}
          </motion.div>
        )}

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
                  加载更多 ({displayedImages.length}/{images.length})
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
              已展示全部 {images.length} 张图片
            </span>
          </div>
        )}
      </main>

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={closeLightbox}
        onPrev={goToPrev}
        onNext={goToNext}
      />
    </>
  );
}