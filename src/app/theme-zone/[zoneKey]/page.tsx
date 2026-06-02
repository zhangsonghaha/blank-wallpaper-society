"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import Lightbox from "@/components/Lightbox";
import type { GalleryImage } from "@/data/images";

interface ZoneImage {
  id: number;
  title: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  category: string;
  view_count: number;
  download_count: number;
  dominant_color: string | null;
  tags: string;
  author: string;
}

interface ZoneInfo {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  categories: string[];
  tags: string[];
  cover: { id: number; url: string; thumbnail_url: string } | null;
}

export default function ThemeZoneDetailPage() {
  const params = useParams();
  const zoneKey = params.zoneKey as string;

  const [zone, setZone] = useState<ZoneInfo | null>(null);
  const [images, setImages] = useState<ZoneImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 加载图片
  const fetchImages = useCallback(
    (pageNum: number = 1, append: boolean = false) => {
      setImagesLoading(true);
      setError(null);
      fetch(
        `/api/discover/theme-zone-detail?zone_key=${encodeURIComponent(zoneKey)}&page=${pageNum}&limit=24`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
            setLoading(false);
            setImagesLoading(false);
            return;
          }
          if (data.zone) {
            setZone(data.zone);
          }
          const newImages = data.data || [];
          if (append) {
            setImages((prev) => [...prev, ...newImages]);
          } else {
            setImages(newImages);
          }
          setTotal(data.total || 0);
          setHasMore(pageNum < (data.totalPages || 1));
          setLoading(false);
          setImagesLoading(false);
        })
        .catch(() => {
          setError("加载失败，请稍后重试");
          setLoading(false);
          setImagesLoading(false);
        });
    },
    [zoneKey]
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

  // 响应式列数
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
    const cols: ZoneImage[][] = Array.from({ length: colCount }, () => []);
    images.forEach((img, index) => {
      cols[index % colCount].push(img);
    });
    return cols;
  })();

  // Lightbox 格式
  const lightboxImages: GalleryImage[] = images.map((img) => ({
    id: img.id,
    src: img.url,
    width: img.width || 600,
    height: img.height || 800,
    title: img.title,
    description: "",
    tags: img.tags ? img.tags.split(",").map((t) => t.trim()) : [],
    author: img.author || "未知",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${img.author || img.id}`,
  }));

  // 加载中
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  // 错误状态
  if (error || !zone) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)] flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-[var(--color-mute)]">
          {error || "专区不存在"}
        </p>
        <Link href="/">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-[var(--color-hairline)] text-[var(--color-ink)] text-sm font-medium rounded-full hover:bg-[var(--color-surface-soft)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </button>
        </Link>
      </div>
    );
  }

  const coverUrl = zone.cover?.thumbnail_url || zone.cover?.url || null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      {/* Header */}
      <div className="relative h-56 md:h-72 overflow-hidden">
        {/* Cover Image or Gradient */}
        {coverUrl ? (
          <>
            <img
              src={coverUrl}
              alt={zone.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)] to-purple-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-4 left-4 z-10">
          <Link href="/">
            <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
        </div>

        {/* Zone Info */}
        <div className="absolute bottom-6 left-0 right-0 px-4">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{zone.icon}</span>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {zone.title}
              </h1>
            </div>
            <p className="text-white/80 text-sm md:text-base max-w-2xl">
              {zone.subtitle}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-white/70 text-sm">
                <ImageIcon className="w-4 h-4" /> {total} 张图片
              </span>
              {zone.categories.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {zone.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 bg-white/15 text-white/80 text-xs rounded-full backdrop-blur-sm"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Images Grid */}
      <div className="max-w-[1400px] mx-auto px-4 py-6 pb-12">
        {images.length === 0 && !imagesLoading ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 text-[var(--color-ash)] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[var(--color-ink)] mb-2">
              专区暂无图片
            </h3>
            <p className="text-[var(--color-mute)]">
              请联系管理员为这个专区添加图片
            </p>
          </div>
        ) : (
          <div className="flex gap-1.5 sm:gap-4">
            {columns.map((col, colIndex) => (
              <div
                key={colIndex}
                className="flex-1 flex flex-col gap-1.5 sm:gap-4"
              >
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
        {!hasMore && images.length > 0 && (
          <div className="text-center py-6 text-sm text-[var(--color-ash)]">
            已展示全部 {total} 张图片
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
        onJumpToImage={(imageId) => {
          const idx = lightboxImages.findIndex((img) => img.id === imageId);
          if (idx >= 0) setLightboxIndex(idx);
        }}
      />
    </div>
  );
}
