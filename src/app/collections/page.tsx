"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import Link from "next/link";
import {
  Plus,
  Grid3X3,
  Lock,
  Globe,
  Users,
  Image as ImageIcon,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CollectionDialog from "@/components/CollectionDialog";

interface Collection {
  id: number;
  title: string;
  description: string | null;
  cover_image_id: number | null;
  user_id: number;
  is_public: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_avatar: string | null;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
  image_count: number;
  subscriber_count: number;
  is_subscribed?: boolean;
}

export default function CollectionsPage() {
  const { data: session } = useSession();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchCollections = useCallback(
    (pageNum: number = 1, append: boolean = false) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: "12",
      });
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      fetch(`/api/collections?${params}`)
        .then((res) => res.json())
        .then((data) => {
          const newCollections = data.data || [];
          if (append) {
            setCollections((prev) => [...prev, ...newCollections]);
          } else {
            setCollections(newCollections);
          }
          setTotal(data.total || 0);
          setHasMore(pageNum < (data.totalPages || 1));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    },
    [searchQuery]
  );

  useEffect(() => {
    fetchCollections(1, false);
  }, [fetchCollections]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCollections(nextPage, true);
  };

  const handleSubscribe = async (collectionId: number, isSubscribed: boolean) => {
    if (!session) {
      toast.error("请先登录");
      return;
    }
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(
        `/api/collections/${collectionId}/subscribe`,
        { method: isSubscribed ? "DELETE" : "POST", headers: { ...csrfHeaders } }
      );
      if (res.ok) {
        toast.success(isSubscribed ? "已取消订阅" : "订阅成功");
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  is_subscribed: !isSubscribed,
                  subscriber_count: isSubscribed
                    ? c.subscriber_count - 1
                    : c.subscriber_count + 1,
                }
              : c
          )
        );
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-purple-600 py-16 px-4">
        <div className="max-w-[1400px] mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            壁纸合集
          </h1>
          <p className="text-white/80 text-lg mb-8">
            精选主题壁纸合集，发现更多灵感
          </p>

          {/* Search & Create */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索合集..."
                className="w-full h-12 pl-11 pr-4 bg-white/15 text-white placeholder:text-white/50 rounded-full backdrop-blur-sm focus:outline-none focus:bg-white/25 transition-all"
              />
            </div>
            {session && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="rounded-full bg-white text-[var(--color-primary)] hover:bg-white/90 gap-2 h-12 px-6 font-bold"
              >
                <Plus className="w-5 h-5" />
                创建合集
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {loading && collections.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-2xl skeleton-pulse bg-[var(--color-surface-card)]"
              />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-20">
            <Grid3X3 className="w-16 h-16 text-[var(--color-ash)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[var(--color-ink)] mb-2">
              暂无合集
            </h3>
            <p className="text-[var(--color-mute)] mb-6">
              成为第一个创建合集的人吧
            </p>
            {session && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-2"
              >
                <Plus className="w-4 h-4" />
                创建合集
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <AnimatePresence>
                {collections.map((collection, index) => (
                  <motion.div
                    key={collection.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: (index % 8) * 0.05 }}
                  >
                    <Link href={`/collections/${collection.id}`}>
                      <div className="group relative rounded-2xl overflow-hidden bg-[var(--color-surface-card)] shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                        {/* Cover Image */}
                        <div className="relative aspect-[4/3]">
                          {collection.cover_thumbnail_url || collection.cover_url ? (
                            <img
                              src={
                                collection.cover_thumbnail_url ||
                                collection.cover_url ||
                                ""
                              }
                              alt={collection.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)]/20 to-purple-200 flex items-center justify-center">
                              <Grid3X3 className="w-12 h-12 text-[var(--color-primary)]/40" />
                            </div>
                          )}

                          {/* Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                          {/* Private Badge */}
                          {!collection.is_public && (
                            <div className="absolute top-3 right-3">
                              <span className="flex items-center gap-1 px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm">
                                <Lock className="w-3 h-3" />
                                私密
                              </span>
                            </div>
                          )}

                          {/* Stats on hover */}
                          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                            <span className="flex items-center gap-1 text-white text-xs">
                              <ImageIcon className="w-3.5 h-3.5" />
                              {collection.image_count} 张
                            </span>
                            <span className="flex items-center gap-1 text-white text-xs">
                              <Users className="w-3.5 h-3.5" />
                              {collection.subscriber_count}
                            </span>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                          <h3 className="font-semibold text-[var(--color-ink)] truncate">
                            {collection.title}
                          </h3>
                          {collection.description && (
                            <p className="text-sm text-[var(--color-mute)] mt-1 line-clamp-2">
                              {collection.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3">
                            <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center overflow-hidden">
                              {collection.author_avatar ? (
                                <img
                                  src={collection.author_avatar}
                                  alt={collection.author_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-[var(--color-primary)]">
                                  {collection.author_name?.[0]}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--color-mute)]">
                              {collection.author_name}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  onClick={handleLoadMore}
                  disabled={loading}
                  variant="outline"
                  className="rounded-full gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Dialog */}
      <CollectionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchCollections(1, false);
        }}
      />
    </div>
  );
}