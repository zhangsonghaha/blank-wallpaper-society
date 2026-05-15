"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PinCard from "./PinCard";
import FilterChips from "./FilterChips";
import Lightbox from "./Lightbox";
import ColorSearch from "./ColorSearch";
import AdvancedFilterPanel from "./AdvancedFilterPanel";
import { useSearch } from "@/context/SearchContext";
import Link from "next/link";
import { ChevronRight, Users, Image as ImageIcon, Filter, Sparkles } from "lucide-react";
import HotRankings from "./HotRankings";
import RecommendForYou from "./RecommendForYou";

interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  gps?: { lat: number; lng: number };
  orientation?: number;
  software?: string;
}

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
  dominant_color?: string | null;
  color_palette?: string | null;
  media_type?: "image" | "video";
  video_url?: string | null;
  poster_url?: string | null;
  uploaded_by?: number | null;
  exif?: string | ExifData | null;
  author_level?: number | null;
  author_level_title?: string | null;
}

interface CategoryRecord {
  id: number;
  name: string;
  slug: string;
}

const ITEMS_PER_PAGE = 12;

export default function MasonryGrid() {
  const {
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    setFavoriteCount,
    showFavoritesOnly,
    setShowFavoritesOnly,
    sortBy,
    setSortBy,
    activeColor,
    setActiveColor,
    colorThreshold,
    showAdvancedFilter,
    setShowAdvancedFilter,
    resolutionFilter,
    dateFilter,
  } = useSearch();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [authorLevels, setAuthorLevels] = useState<Record<number, { level: number; title: string }>>({});
  const [searchEngine, setSearchEngine] = useState<string>("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [totalCount, setTotalCount] = useState(0);
  const favoritesRef = useRef<HTMLDivElement>(null);

  // 精选合集
  const [featuredCollections, setFeaturedCollections] = useState<any[]>([]);

  // 处理 URL hash 变化
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === "#favorites") {
        setShowFavoritesOnly(true);
        setTimeout(() => {
          favoritesRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else if (hash === "#popular") {
        setSortBy("popular");
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [setShowFavoritesOnly, setSortBy]);

  // 加载分类
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data || []))
      .catch(() => {});
  }, []);

  // 加载精选合集
  useEffect(() => {
    fetch("/api/collections?featured=true&limit=6")
      .then((res) => res.json())
      .then((data) => setFeaturedCollections(data.data || []))
      .catch(() => {});
  }, []);

  // 加载图片
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();

    if (activeColor) {
      // 颜色搜索使用专门的API
      params.set("color", activeColor);
      params.set("threshold", String(colorThreshold));
    }
    
    // 通用参数
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (searchQuery.trim()) params.set("search", searchQuery);
    if (sortBy) params.set("sort", sortBy);
    
    // 分辨率筛选
    if (resolutionFilter.minWidth) params.set("minWidth", String(resolutionFilter.minWidth));
    if (resolutionFilter.maxWidth) params.set("maxWidth", String(resolutionFilter.maxWidth));
    if (resolutionFilter.minHeight) params.set("minHeight", String(resolutionFilter.minHeight));
    if (resolutionFilter.maxHeight) params.set("maxHeight", String(resolutionFilter.maxHeight));
    
    // 日期筛选
    if (dateFilter.from) params.set("dateFrom", dateFilter.from);
    if (dateFilter.to) params.set("dateTo", dateFilter.to);
    
    params.set("limit", "100");

    if (activeColor) {
      fetch(`/api/images/search/color?${params}`)
        .then((res) => res.json())
        .then((data) => {
          setImages(data.data || []);
          setTotalCount(data.total || 0);
          setVisibleCount(ITEMS_PER_PAGE);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      fetch(`/api/images?${params}`)
        .then((res) => res.json())
        .then((data) => {
          setImages(data.data || []);
          setTotalCount(data.total || 0);
          setSearchEngine(data._searchEngine || "");
          setVisibleCount(ITEMS_PER_PAGE);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [activeCategory, searchQuery, activeColor, colorThreshold, sortBy, resolutionFilter, dateFilter]);

  // 从API加载初始收藏列表
  useEffect(() => {
    fetch("/api/favorites?limit=100")
      .then((res) => {
        if (!res.ok) return { data: [] };
        return res.json();
      })
      .then((data) => {
        const favIds = new Set<number>(
          (data.data || []).map((item: any) => item.id)
        );
        setFavorites(favIds);
      })
      .catch(() => {});
  }, []);

  // 批量获取作者等级信息
  useEffect(() => {
    if (images.length === 0) return;
    const authorIds = [...new Set(images.map((img) => img.uploaded_by).filter(Boolean))] as number[];
    if (authorIds.length === 0) return;

    fetch(`/api/user/level/batch?ids=${authorIds.join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setAuthorLevels(data.data);
      })
      .catch(() => {});
  }, [images]);

  // 同步收藏数量到 Context
  useEffect(() => {
    setFavoriteCount(favorites.size);
  }, [favorites.size, setFavoriteCount]);

  // 排序和筛选
  const filteredImages = useMemo(() => {
    let result = [...images];

    // 收藏筛选
    if (showFavoritesOnly) {
      result = result.filter((img) => favorites.has(img.id));
    }

    // 排序
    if (sortBy === "popular") {
      result.sort((a, b) => b.view_count - a.view_count);
    }
    // latest: 保持原始顺序（API已按时间倒序）

    return result;
  }, [images, showFavoritesOnly, favorites, sortBy]);

  // 分页
  const displayedImages = useMemo(() => {
    return filteredImages.slice(0, visibleCount);
  }, [filteredImages, visibleCount]);

  const hasMore = visibleCount < filteredImages.length;

  // 收藏切换
  const toggleFavorite = useCallback((id: number) => {
    const isFav = favorites.has(id);
    // 乐观更新UI
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 调用favorites API
    if (isFav) {
      fetch(`/api/favorites/${id}`, { method: "DELETE" })
        .then((res) => {
          if (!res.ok) {
            // 回滚
            setFavorites((prev) => new Set(prev).add(id));
          }
        })
        .catch(() => {
          setFavorites((prev) => new Set(prev).add(id));
        });
    } else {
      fetch(`/api/favorites/${id}`, { method: "POST" })
        .then((res) => {
          if (!res.ok) {
            // 回滚
            setFavorites((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }
        })
        .catch(() => {
          setFavorites((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        });
    }
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
        prev === 0 ? filteredImages.length - 1 : prev - 1
      ),
    [filteredImages.length]
  );
  const goToNext = useCallback(
    () =>
      setLightboxIndex((prev) =>
        prev === filteredImages.length - 1 ? 0 : prev + 1
      ),
    [filteredImages.length]
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
      filteredImages.map((img) => {
        // 解析 exif JSON
        let parsedExif: ExifData | null = null;
        if (img.exif) {
          try {
            parsedExif = typeof img.exif === "string" ? JSON.parse(img.exif) : img.exif;
          } catch {
            parsedExif = null;
          }
        }
        return {
          id: img.id,
          src: img.url,
          width: img.width || 600,
          height: img.height || 800,
          title: img.title,
          description: img.description,
          tags: img.tags ? img.tags.split(",").map((t) => t.trim()) : [],
          author: img.author || "未知",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${img.author || img.id}`,
          media_type: img.media_type || "image",
          video_url: img.video_url || undefined,
          poster_url: img.poster_url || undefined,
          uploaded_by: img.uploaded_by || undefined,
          exif: parsedExif,
        };
      }),
    [filteredImages]
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
          {(searchQuery || activeColor) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-card)] rounded-full text-sm"
            >
              {searchQuery && (
                <>
                  <svg className="w-4 h-4 text-[var(--color-mute)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>
                    搜索 &ldquo;{searchQuery}&rdquo;
                  </span>
                </>
              )}
              {activeColor && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full border border-[var(--color-hairline-soft)]"
                    style={{ backgroundColor: activeColor }}
                  />
                  按颜色筛选
                </span>
              )}
              <span>共找到 <strong>{totalCount}</strong> 张图片</span>
              {searchEngine === "meilisearch" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold rounded-full">
                  <Sparkles className="w-3 h-3" />
                  智能搜索
                </span>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveColor(null);
                }}
                className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--color-secondary-bg)] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          )}

          {/* 筛选栏: 收藏筛选 + 颜色筛选 + 排序 */}
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            {/* 颜色筛选 */}
            <ColorSearch
              activeColor={activeColor}
              onColorSelect={(color) => {
                setActiveColor(color);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
            />

            {/* 收藏筛选 */}
            <button
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                if (!showFavoritesOnly) {
                  setTimeout(() => {
                    favoritesRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full transition-all ${
                showFavoritesOnly
                  ? "bg-[var(--color-primary)] text-white"
                  : favorites.size > 0
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
                    : "bg-[var(--color-surface-card)] text-[var(--color-mute)]"
              }`}
            >
              <svg className="w-4 h-4" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {showFavoritesOnly ? "查看全部" : `收藏 (${favorites.size})`}
            </button>

            {/* 排序切换 */}
            <div className="inline-flex items-center bg-[var(--color-surface-card)] rounded-full p-0.5">
              <button
                onClick={() => setSortBy("latest")}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                  sortBy === "latest"
                    ? "bg-[var(--color-ink)] text-white"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                最新
              </button>
              <button
                onClick={() => setSortBy("popular")}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                  sortBy === "popular"
                    ? "bg-[var(--color-ink)] text-white"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                热门
              </button>
            </div>
          </div>
        </div>

        {/* 收藏区域锚点 */}
        <div ref={favoritesRef} id="favorites" className="scroll-mt-32" />

        {/* Featured Collections */}
        {featuredCollections.length > 0 && !searchQuery && !activeColor && !showFavoritesOnly && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--color-ink)]">
                精选合集
              </h2>
              <Link
                href="/collections"
                className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium hover:underline"
              >
                查看全部
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {featuredCollections.map((col: any) => (
                <Link
                  key={col.id}
                  href={`/collections/${col.id}`}
                  className="shrink-0 w-52 group"
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[var(--color-surface-card)]">
                    {col.cover_thumbnail_url || col.cover_url ? (
                      <img
                        src={col.cover_thumbnail_url || col.cover_url}
                        alt={col.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)]/20 to-purple-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--color-primary)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-white text-[10px]">
                        <ImageIcon className="w-3 h-3" /> {col.image_count || 0}
                      </span>
                      <span className="flex items-center gap-1 text-white text-[10px]">
                        <Users className="w-3 h-3" /> {col.subscriber_count || 0}
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-[var(--color-ink)] truncate">
                    {col.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Hot Rankings - 热门排行 */}
        {!searchQuery && !activeColor && !showFavoritesOnly && <HotRankings />}

        {/* Recommendations - 猜你喜欢 */}
        {!searchQuery && !activeColor && !showFavoritesOnly && <RecommendForYou />}

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
            key={activeCategory + searchQuery + String(showFavoritesOnly) + sortBy + (activeColor || "")}
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
                          media_type: image.media_type || "image",
                          video_url: image.video_url || undefined,
                          poster_url: image.poster_url || undefined,
                          uploaded_by: image.uploaded_by || undefined,
                          author_level: image.uploaded_by != null && authorLevels[image.uploaded_by] ? authorLevels[image.uploaded_by].level : undefined,
                          author_level_title: image.uploaded_by != null && authorLevels[image.uploaded_by] ? authorLevels[image.uploaded_by].title : undefined,
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
              {showFavoritesOnly ? (
                <svg className="w-10 h-10 text-[var(--color-ash)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-[var(--color-ash)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-ink)] mb-2">
              {showFavoritesOnly ? "还没有收藏" : (searchQuery || activeColor) ? "没有找到匹配的图片" : "还没有图片"}
            </h3>
            <p className="text-[var(--color-mute)] mb-6">
              {showFavoritesOnly
                ? "浏览图片时点击收藏按钮添加到收藏夹"
                : (searchQuery || activeColor)
                  ? "试试其他关键词、更换颜色或清除搜索条件"
                  : "去管理后台上传第一张图片吧"}
            </p>
            {showFavoritesOnly ? (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors active:scale-95"
              >
                浏览全部图片
              </button>
            ) : (searchQuery || activeColor) ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveColor(null);
                }}
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
                  加载更多 ({displayedImages.length}/{filteredImages.length})
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
              已展示全部 {filteredImages.length} 张图片
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
        favoritedIds={favorites}
        onToggleFavorite={toggleFavorite}
      />

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
      />
    </>
  );
}