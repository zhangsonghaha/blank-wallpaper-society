"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Rss,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface DailyImage {
  id: number;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  category: string;
  tags: string;
  author: string;
  view_count: number;
  download_count: number;
  favorite_count: number;
  dominant_color: string | null;
  media_type?: string;
  video_url?: string;
}

interface DailyWallpaperData {
  date: string;
  pick: DailyImage | null;
  collection: DailyImage[];
  theme: string;
}

interface DailyWallpaperCardProps {
  onViewLightbox?: (imageId: number) => void;
}

/** 根据图片宽高比计算容器高度：最小 280px，最大 520px */
function calcContainerHeight(w: number, h: number): string {
  const aspect = w / h;
  // 超宽图（横屏壁纸）：限制最大高度，让宽度撑满
  // 窄高图（竖屏壁纸）：允许更高
  const minH = 280;
  const maxH = 520;
  let targetH: number;
  if (aspect >= 2) {
    // 超宽壁纸（如 21:9）
    targetH = minH;
  } else if (aspect >= 1.2) {
    // 标准横屏壁纸（16:9 ~ 4:3）
    targetH = Math.min(400, Math.max(minH, Math.round(600 / aspect)));
  } else {
    // 竖屏壁纸
    targetH = maxH;
  }
  return `${targetH}px`;
}

export default function DailyWallpaperCard({
  onViewLightbox,
}: DailyWallpaperCardProps) {
  const [data, setData] = useState<DailyWallpaperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCollection, setShowCollection] = useState(false);
  const [collectionIndex, setCollectionIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDaily = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/daily-wallpaper");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("获取每日壁纸失败:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  // 所有 Hooks 必须在早期返回之前调用（React Rules of Hooks）
  const currentImage = data && showCollection && data.collection.length > 0
    ? data.collection[collectionIndex]
    : data?.pick ?? null;

  const containerHeight = useMemo(
    () => calcContainerHeight(currentImage?.width || 16, currentImage?.height || 9),
    [currentImage?.width, currentImage?.height]
  );

  const handleRefresh = () => {
    setShowCollection((prev) => !prev);
    if (showCollection && data?.collection) {
      setCollectionIndex(
        (prev) => (prev + 1) % data.collection.length
      );
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatWeekday = (dateStr: string) => {
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `周${weekdays[new Date(dateStr).getDay()]}`;
  };

  if (loading) {
    return (
      <div className="relative w-full h-[320px] sm:h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data?.pick) return null;

  // 每日精选优先使用原图 URL 以保证清晰度，Next.js Image 会自动优化尺寸
  const imageSrc = currentImage?.url || currentImage?.thumbnail_url || "";
  const isVideo = currentImage?.media_type === "video" && currentImage?.video_url;



  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative w-full rounded-2xl overflow-hidden group cursor-pointer shadow-xl"
      style={{ height: containerHeight }}
      onClick={() => currentImage?.id && onViewLightbox?.(currentImage.id)}
    >
      {/* 背景层：模糊放大版本填充空白区域，暗色叠加压制亮度 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${currentImage?.id || "daily"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0"
        >
          {!isVideo && (
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover scale-110 blur-2xl opacity-50 saturate-[1.2]"
              sizes="100vw"
              priority
            />
          )}
          {/* 暗色叠加层：防止模糊背景过亮干扰信息阅读 */}
          <div className="absolute inset-0 bg-black/30" />
        </motion.div>
      </AnimatePresence>

      {/* 前景层：清晰完整展示图片 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage?.id || "daily"}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-[1]"
        >
          {isVideo ? (
            <DailyVideoPlayer
              src={currentImage.video_url!}
              poster={currentImage.thumbnail_url || currentImage.url}
            />
          ) : (
            <Image
              src={imageSrc}
              alt={currentImage?.title || "每日壁纸"}
              fill
              className="object-contain transition-transform duration-700 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
              priority
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* 动态壁纸 LIVE 标签 */}
      {isVideo && (
        <div className="absolute top-14 left-4 z-20">
          <span className="text-[10px] font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-1 rounded">
            LIVE
          </span>
        </div>
      )}

      {/* 顶部标签 — 紧凑化，减少遮挡 */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/30 backdrop-blur-md rounded-full text-white text-[11px] font-medium">
            <Sparkles className="w-3 h-3 text-yellow-300" />
            每日精选
          </span>
          {data.theme && (
            <span className="inline-flex items-center px-2.5 py-1 bg-black/25 backdrop-blur-md rounded-full text-white/80 text-[11px]">
              {data.theme}
            </span>
          )}
        </div>

        <Link
          href="/api/daily-wallpaper/rss"
          target="_blank"
          className="inline-flex items-center gap-1 px-2 py-1 bg-black/25 backdrop-blur-md rounded-full text-white/60 text-[11px] hover:text-white hover:bg-black/40 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Rss className="w-3 h-3" />
          RSS
        </Link>
      </div>

      {/* 底部渐变遮罩 — 仅覆盖底部信息区，不遮挡中间画面 */}
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/70 to-transparent z-10" />

      {/* 底部信息 — 紧凑单行布局 */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8 z-10">
        <div className="flex items-end justify-between gap-3">
          {/* 左侧：标题 + 日期 */}
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-sm sm:text-base font-semibold line-clamp-1 leading-tight">
              {currentImage?.title || "今日精选壁纸"}
            </h2>
            <span className="text-white/50 text-[11px] mt-0.5 block">
              {formatDate(data.date)} {formatWeekday(data.date)}
            </span>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement("a");
                a.href = currentImage?.url || "";
                a.download = currentImage?.title || "wallpaper";
                a.target = "_blank";
                a.click();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">设为壁纸</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/15 backdrop-blur-md text-white rounded-lg text-xs font-medium hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 transition-transform ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">换一换</span>
            </button>

            <Link
              href="/?sort=popular"
              className="inline-flex items-center text-white/40 text-xs hover:text-white/70 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 备选指示器 */}
      {showCollection && data.collection.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
          <motion.div
            className="h-full bg-white/40"
            initial={{ width: "0%" }}
            animate={{
              width: `${((collectionIndex + 1) / data.collection.length) * 100}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}
    </motion.div>
  );
}

/** 每日精选卡片内的视频播放器（自动循环静音播放） */
function DailyVideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
    />
  );
}