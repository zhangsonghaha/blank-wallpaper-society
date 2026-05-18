"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  ArrowLeft,
  Users,
  Image as ImageIcon,
  Lock,
  Globe,
  Calendar,
  Bell,
  BellOff,
  Settings,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Lightbox from "@/components/Lightbox";
import type { GalleryImage } from "@/data/images";

interface CollectionData {
  id: number;
  title: string;
  description: string | null;
  cover_image_id: number | null;
  user_id: number;
  is_public: number;
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

interface ImageData {
  id: number;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  author: string;
  tags: string;
  category: string;
  sort_order: number;
  added_at: string;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const collectionId = params.id as string;
  const { data: session } = useSession();

  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [subscribing, setSubscribing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载合集信息
  useEffect(() => {
    fetch(`/api/collections/${collectionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCollection(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [collectionId]);

  // 加载合集图片
  const fetchImages = useCallback(
    (pageNum: number = 1, append: boolean = false) => {
      setImagesLoading(true);
      fetch(`/api/collections/${collectionId}/images?page=${pageNum}&limit=24`)
        .then((res) => res.json())
        .then((data) => {
          const newImages = data.data || [];
          if (append) {
            setImages((prev) => [...prev, ...newImages]);
          } else {
            setImages(newImages);
          }
          setHasMore(pageNum < (data.totalPages || 1));
          setImagesLoading(false);
        })
        .catch(() => setImagesLoading(false));
    },
    [collectionId]
  );

  useEffect(() => {
    fetchImages(1, false);
  }, [fetchImages]);

  // 无限滚动
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !imagesLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchImages(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, imagesLoading, page, fetchImages]);

  // 订阅/取消订阅
  const handleSubscribe = async () => {
    if (!session) {
      toast.error("请先登录");
      return;
    }
    if (!collection) return;
    setSubscribing(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/collections/${collectionId}/subscribe`, {
        method: collection.is_subscribed ? "DELETE" : "POST",
        headers: { ...csrfHeaders },
      });
      if (res.ok) {
        toast.success(collection.is_subscribed ? "已取消订阅" : "订阅成功");
        setCollection((prev) =>
          prev
            ? {
                ...prev,
                is_subscribed: !prev.is_subscribed,
                subscriber_count: prev.is_subscribed
                  ? prev.subscriber_count - 1
                  : prev.subscriber_count + 1,
              }
            : prev
        );
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("操作失败");
    }
    setSubscribing(false);
  };

  // 删除合集
  const handleDelete = async () => {
    if (!confirm("确定要删除此合集吗？此操作不可撤销。")) return;
    setDeleting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "DELETE",
        headers: { ...csrfHeaders },
      });
      if (res.ok) {
        toast.success("合集已删除");
        window.location.href = "/collections";
      } else {
        const data = await res.json();
        toast.error(data.error);
      }
    } catch {
      toast.error("删除失败");
    }
    setDeleting(false);
  };

  const isOwner =
    session && collection && String((session.user as any).id) === String(collection.user_id);

  // 瀑布流分列 - 响应式
  const [colCount, setColCount] = useState(4);
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w < 640) setColCount(2);
      else if (w < 1024) setColCount(3);
      else setColCount(4);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const columns = (() => {
    const cols: ImageData[][] = Array.from({ length: colCount }, () => []);
    images.forEach((img, index) => {
      cols[index % colCount].push(img);
    });
    return cols;
  })();

  // Lightbox 图片格式
  const lightboxImages: GalleryImage[] = images.map((img) => ({
    id: img.id,
    src: img.url,
    width: img.width || 600,
    height: img.height || 800,
    title: img.title,
    description: img.description,
    tags: img.tags ? img.tags.split(",").map((t) => t.trim()) : [],
    author: img.author || "未知",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${img.author || img.id}`,
  }));

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)] flex flex-col items-center justify-center">
        <p className="text-lg text-[var(--color-mute)] mb-4">合集不存在或无权访问</p>
        <Link href="/collections">
          <Button variant="outline" className="rounded-full gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回合集列表
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      {/* Header with Cover */}
      <div className="relative h-64 md:h-80">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] to-purple-600" />
        {collection.cover_url && (
          <img
            src={collection.cover_url}
            alt={collection.title}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-4 left-4 z-10">
          <Link href="/collections">
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
        </div>

        {/* Collection Info */}
        <div className="absolute bottom-6 left-0 right-0 px-4">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center gap-2 mb-2">
              {!collection.is_public && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full backdrop-blur-sm">
                  <Lock className="w-3 h-3" /> 私密
                </span>
              )}
              {collection.is_public && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full backdrop-blur-sm">
                  <Globe className="w-3 h-3" /> 公开
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {collection.title}
            </h1>
            {collection.description && (
              <p className="text-white/80 text-sm md:text-base max-w-2xl">
                {collection.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 overflow-hidden">
                  {collection.author_avatar ? (
                    <img
                      src={collection.author_avatar}
                      alt={collection.author_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                      {collection.author_name?.[0]}
                    </div>
                  )}
                </div>
                <span className="text-white/90 text-sm font-medium">
                  {collection.author_name}
                </span>
              </div>
              <span className="flex items-center gap-1 text-white/70 text-sm">
                <ImageIcon className="w-4 h-4" /> {collection.image_count} 张
              </span>
              <span className="flex items-center gap-1 text-white/70 text-sm">
                <Users className="w-4 h-4" /> {collection.subscriber_count} 订阅
              </span>
              <span className="flex items-center gap-1 text-white/70 text-sm">
                <Calendar className="w-4 h-4" />{" "}
                {new Date(collection.created_at).toLocaleDateString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          {!isOwner && session && (
            <Button
              onClick={handleSubscribe}
              disabled={subscribing}
              className={`rounded-full gap-2 ${
                collection.is_subscribed
                  ? "bg-white text-[var(--color-ink)] border border-[var(--color-hairline)] hover:bg-[var(--color-surface-soft)]"
                  : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] text-white"
              }`}
            >
              {subscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : collection.is_subscribed ? (
                <BellOff className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              {collection.is_subscribed ? "已订阅" : "订阅"}
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                variant="outline"
                className="rounded-full gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                删除合集
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Masonry Grid */}
      <div className="max-w-[1400px] mx-auto px-4 pb-12">
        {images.length === 0 && !imagesLoading ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 text-[var(--color-ash)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[var(--color-ink)] mb-2">
              合集还是空的
            </h3>
            <p className="text-[var(--color-mute)]">
              {isOwner
                ? "浏览图片并添加到这个合集中"
                : "合集作者还没有添加图片"}
            </p>
          </div>
        ) : (
          <div className="flex gap-1.5 sm:gap-4">
            {columns.map((col, colIndex) => (
              <div key={colIndex} className="flex-1 flex flex-col gap-1.5 sm:gap-4">
                {col.map((img) => (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group cursor-pointer rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-surface-card)] shadow-sm hover:shadow-md transition-shadow"
                    onClick={() => {
                      const idx = images.findIndex((i) => i.id === img.id);
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  >
                    <div
                      className="relative"
                      style={{
                        aspectRatio: `${img.width || 600}/${img.height || 800}`,
                      }}
                    >
                      <img
                        src={img.thumbnail_url || img.url}
                        alt={img.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white font-medium truncate">
                          {img.title}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Load More Trigger */}
        <div ref={loadMoreRef} className="h-10" />
        {imagesLoading && images.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onPrev={() =>
          setLightboxIndex((prev) =>
            prev === 0 ? lightboxImages.length - 1 : prev - 1
          )
        }
        onNext={() =>
          setLightboxIndex((prev) =>
            prev === lightboxImages.length - 1 ? 0 : prev + 1
          )
        }
      />
    </div>
  );
}