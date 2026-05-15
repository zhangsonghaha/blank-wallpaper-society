"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
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

  const currentImage = showCollection && data.collection.length > 0
    ? data.collection[collectionIndex]
    : data.pick;

  const imageSrc = currentImage?.thumbnail_url || currentImage?.url || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative w-full h-[320px] sm:h-[400px] rounded-2xl overflow-hidden group cursor-pointer shadow-xl"
      onClick={() => onViewLightbox?.(currentImage?.id)}
    >
      {/* 背景图片 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage?.id || "daily"}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <Image
            src={imageSrc}
            alt={currentImage?.title || "每日壁纸"}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 80vw"
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

      {/* 顶部标签 */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            每日精选
          </span>
          {data.theme && (
            <span className="inline-flex items-center px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-white/90 text-xs border border-white/10">
              {data.theme}
            </span>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link
            href="/api/daily-wallpaper/rss"
            target="_blank"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-white/70 text-xs hover:text-white hover:bg-white/20 transition-colors border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <Rss className="w-3 h-3" />
            RSS
          </Link>
        </motion.div>
      </div>

      {/* 底部信息 */}
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {/* 日期 */}
          <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(data.date)}</span>
            <span className="text-white/40">|</span>
            <span>{formatWeekday(data.date)}</span>
          </div>

          {/* 标题 */}
          <h2 className="text-white text-lg sm:text-xl font-semibold mb-2 line-clamp-1">
            {currentImage?.title || "今日精选壁纸"}
          </h2>

          {/* 描述 */}
          {currentImage?.description && (
            <p className="text-white/60 text-sm line-clamp-1 mb-3 max-w-lg">
              {currentImage.description}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // 触发下载
                const a = document.createElement("a");
                a.href = currentImage?.url || "";
                a.download = currentImage?.title || "wallpaper";
                a.target = "_blank";
                a.click();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              设为壁纸
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/15 backdrop-blur-md text-white rounded-lg text-sm font-medium hover:bg-white/25 transition-colors border border-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 transition-transform ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              换一换
            </button>

            <Link
              href="/?sort=popular"
              className="inline-flex items-center gap-1 text-white/50 text-sm hover:text-white/80 transition-colors ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              查看更多
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* 备选指示器 */}
      {showCollection && data.collection.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-10">
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