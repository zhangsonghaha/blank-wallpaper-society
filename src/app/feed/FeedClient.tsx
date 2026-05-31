"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Users,
  Sparkles,
  TrendingUp,
  LayoutGrid,
  Loader2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import PinCard from "@/components/PinCard";
import PostEditor from "@/components/PostEditor";
import PostCard from "@/components/PostCard";

const FEED_TYPES = [
  { id: "all", label: "全部", icon: LayoutGrid },
  { id: "posts", label: "动态", icon: FileText },
  { id: "images", label: "壁纸", icon: ImageIcon },
  { id: "following", label: "关注", icon: Users },
  { id: "recommended", label: "推荐", icon: Sparkles },
  { id: "trending", label: "热门", icon: TrendingUp },
];

interface FeedItem {
  id: string;
  type: "post" | "image";
  data: any;
  created_at: string;
}

export default function FeedClient() {
  const { status } = useSession();
  const [feedType, setFeedType] = useState("all");
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchFeed = useCallback(async (type: string, pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    try {
      let newItems: FeedItem[] = [];

      if (type === "posts" || type === "all") {
        // 获取帖子
        const postsRes = await fetch(`/api/posts?page=${pageNum}&limit=10`);
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          const posts: FeedItem[] = (postsData.data || []).map((post: any) => ({
            id: `post-${post.id}`,
            type: "post" as const,
            data: post,
            created_at: post.created_at,
          }));
          newItems = [...newItems, ...posts];
        }
      }

      if (type === "images" || type === "all" || type === "following" || type === "recommended" || type === "trending") {
        // 获取图片
        const feedTypeParam = type === "all" ? "all" : type === "images" ? "all" : type;
        const imagesRes = await fetch(`/api/feed?type=${feedTypeParam}&page=${pageNum}&limit=20`);
        if (imagesRes.ok) {
          const imagesData = await imagesRes.json();
          const images: FeedItem[] = (imagesData.data || []).map((img: any) => ({
            id: `image-${img.id}`,
            type: "image" as const,
            data: img,
            created_at: img.created_at,
          }));
          newItems = [...newItems, ...images];
        }
      }

      // 按时间排序混合
      newItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (pageNum === 1) {
        setFeedItems(newItems);
      } else {
        setFeedItems((prev) => [...prev, ...newItems]);
      }

      setHasMore(newItems.length > 0);
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
        setFeedItems((prev) =>
          prev.map((item) =>
            item.type === "image" && item.data.id === imageId
              ? { ...item, data: { ...item.data, is_favorited: !item.data.is_favorited } }
              : item
          )
        );
      }
    } catch (err) {
      console.error("收藏操作失败:", err);
    }
  };

  const handlePostCreated = (newPost: any) => {
    const newItem: FeedItem = {
      id: `post-${newPost.id}`,
      type: "post",
      data: newPost,
      created_at: newPost.created_at,
    };
    setFeedItems((prev) => [newItem, ...prev]);
  };

  const handlePostUpdated = (updatedPost: any) => {
    setFeedItems((prev) =>
      prev.map((item) =>
        item.type === "post" && item.data.id === updatedPost.id
          ? { ...item, data: updatedPost }
          : item
      )
    );
  };

  const handlePostDeleted = (postId: number) => {
    setFeedItems((prev) => prev.filter((item) => !(item.type === "post" && item.data.id === postId)));
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(feedType, nextPage);
  };

  // 分离帖子和图片，用于双列布局
  const posts = feedItems.filter((item) => item.type === "post");
  const images = feedItems.filter((item) => item.type === "image");

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
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
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

      {/* 发布动态编辑器 */}
      {(feedType === "all" || feedType === "posts") && (
        <div className="mb-6 max-w-[680px] mx-auto">
          <PostEditor onPostCreated={handlePostCreated} />
        </div>
      )}

      {/* Feed 内容 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-mute)]" />
        </div>
      ) : feedItems.length === 0 ? (
        <div className="text-center py-20 text-[var(--color-mute)]">
          <p>暂无内容</p>
          {feedType === "following" && <p className="text-sm mt-2">关注更多创作者来获取动态</p>}
        </div>
      ) : (
        <>
          {/* ===== 布局模式 1：「全部」模式 —— 帖子流 + 壁纸瀑布流 ===== */}
          {feedType === "all" && (
            <div className="flex flex-col gap-8">
              {/* 帖子区域：居中窄列 */}
              {posts.length > 0 && (
                <section>
                  {images.length > 0 && (
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-mute)] mb-4 px-1">
                      <FileText className="w-4 h-4" />
                      社区动态
                    </h2>
                  )}
                  <div className="max-w-[680px] mx-auto space-y-0">
                    {posts.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.3 }}
                      >
                        <PostCard
                          post={item.data}
                          onUpdated={handlePostUpdated}
                          onDeleted={handlePostDeleted}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* 图片区域：全宽瀑布流 */}
              {images.length > 0 && (
                <section>
                  {posts.length > 0 && (
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-mute)] mb-4 px-1">
                      <ImageIcon className="w-4 h-4" />
                      精选壁纸
                    </h2>
                  )}
                  <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
                    {images.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx, 20) * 0.02, duration: 0.3 }}
                        className="break-inside-avoid"
                      >
                        <PinCard
                          image={item.data}
                          index={idx}
                          isFavorited={item.data.is_favorited || false}
                          onToggleFavorite={(id) => toggleFavorite(id)}
                          onClick={() => {}}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* ===== 布局模式 2：「动态」模式 —— 帖子居中单列 ===== */}
          {feedType === "posts" && posts.length > 0 && (
            <div className="max-w-[680px] mx-auto space-y-0">
              {posts.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                >
                  <PostCard
                    post={item.data}
                    onUpdated={handlePostUpdated}
                    onDeleted={handlePostDeleted}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* 仅帖子模式且无内容 */}
          {feedType === "posts" && posts.length === 0 && !loading && (
            <div className="text-center py-10 text-[var(--color-mute)]">
              <FileText className="w-12 h-12 mx-auto mb-3 text-[var(--color-ash)]" />
              <p>还没有动态</p>
              <p className="text-sm mt-1">发布第一条动态吧</p>
            </div>
          )}

          {/* ===== 布局模式 3：壁纸 / 关注 / 推荐 / 热门 —— 全宽瀑布流 ===== */}
          {(feedType === "images" || feedType === "following" || feedType === "recommended" || feedType === "trending") && images.length > 0 && (
            <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
              {images.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 20) * 0.02, duration: 0.3 }}
                  className="break-inside-avoid"
                >
                  <PinCard
                    image={item.data}
                    index={idx}
                    isFavorited={item.data.is_favorited || false}
                    onToggleFavorite={(id) => toggleFavorite(id)}
                    onClick={() => {}}
                  />
                </motion.div>
              ))}
            </div>
          )}

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