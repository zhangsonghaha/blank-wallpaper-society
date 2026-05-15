"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Users, Sparkles, TrendingUp, LayoutGrid, Loader2 } from "lucide-react";
import PinCard from "@/components/PinCard";

const FEED_TYPES = [
  { id: "all", label: "全部", icon: LayoutGrid },
  { id: "following", label: "关注", icon: Users },
  { id: "recommended", label: "推荐", icon: Sparkles },
  { id: "trending", label: "热门", icon: TrendingUp },
];

export default function FeedClient() {
  const { status } = useSession();
  const [feedType, setFeedType] = useState("all");
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchFeed = useCallback(async (type: string, pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    try {
      const res = await fetch(`/api/feed?type=${type}&page=${pageNum}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (pageNum === 1) {
          setImages(data.data || []);
        } else {
          setImages((prev) => [...prev, ...(data.data || [])]);
        }
        setHasMore(pageNum < (data.pagination?.totalPages || 1));
      }
    } catch (err) {
      console.error("获取Feed失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchFeed(feedType, 1);
  }, [feedType, fetchFeed]);

  const toggleFavorite = async (imageId: number) => {
    try {
      const res = await fetch(`/api/favorites/${imageId}`, { method: "POST" });
      if (res.ok) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === imageId ? { ...img, is_favorited: !img.is_favorited } : img
          )
        );
      }
    } catch (err) {
      console.error("收藏操作失败:", err);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(feedType, nextPage);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-4">动态</h1>

      {/* Feed 类型筛选 */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {FEED_TYPES.map((ft) => {
          const Icon = ft.icon;
          const disabled = ft.id === "following" && status !== "authenticated";
          return (
            <button
              key={ft.id}
              onClick={() => !disabled && setFeedType(ft.id)}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                feedType === ft.id
                  ? "bg-[var(--color-ink)] text-white"
                  : disabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {ft.label}
            </button>
          );
        })}
      </div>

      {/* Feed 内容 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-mute)]" />
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-mute)]">
          <p>暂无内容</p>
          {feedType === "following" && <p className="text-sm mt-2">关注更多创作者来获取动态</p>}
        </div>
      ) : (
        <>
          <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
            {images.map((img, idx) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
              >
                <PinCard
                  image={img}
                  index={idx}
                  isFavorited={img.is_favorited || false}
                  onToggleFavorite={(id) => toggleFavorite(id)}
                  onClick={() => {}}
                />
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                className="px-6 py-2 text-sm font-semibold rounded-full bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)] transition-colors"
              >
                加载更多
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}