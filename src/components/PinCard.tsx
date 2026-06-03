"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FolderPlus, Play } from "lucide-react";
import Link from "next/link";
import type { GalleryImage } from "@/data/images";
import AddToCollectionDialog from "./AddToCollectionDialog";
import LevelBadge from "./LevelBadge";

interface PinCardProps {
  image: GalleryImage;
  index: number;
  isFavorited: boolean;
  onToggleFavorite: (id: number) => void;
  onClick: () => void;
}

export default function PinCard({
  image,
  index,
  isFavorited,
  onToggleFavorite,
  onClick,
}: PinCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showSaveFeedback, setShowSaveFeedback] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isVideo = image.media_type === "video" && image.video_url;

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(image.id);
    setShowSaveFeedback(true);
    setTimeout(() => setShowSaveFeedback(false), 1500);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/images/${image.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("链接已复制到剪贴板");
    }).catch(() => {
      toast.error("复制失败，请手动复制");
    });
  };

  const tagLabels: Record<string, string> = {
    nature: "自然",
    city: "城市",
    portrait: "人像",
    food: "美食",
    travel: "旅行",
    art: "艺术",
    animals: "动物",
    minimal: "极简",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: (index % 12) * 0.05,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className="pin-card break-inside-avoid mb-4 group cursor-pointer"
      onMouseEnter={() => {
        setIsHovered(true);
        if (isVideo && videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isVideo && videoRef.current) {
          videoRef.current.pause();
        }
      }}
      onClick={onClick}
    >
      <div className="relative rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-surface-card)] shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Image / Video */}
        <div className="relative" style={{ aspectRatio: `${image.width || 16}/${image.height || 9}` }}>
          {/* Loading Skeleton */}
          {!isLoaded && (
            <div className="absolute inset-0 skeleton-pulse bg-[var(--color-surface-card)]" />
          )}

          {/* 视频类型：始终用 video 元素渲染，避免 img 加载 mp4 导致白屏 */}
          {isVideo ? (
            <video
              ref={videoRef}
              src={image.video_url}
              poster={image.poster_url || undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
              onLoadedData={() => setIsLoaded(true)}
              onLoadedMetadata={() => setIsLoaded(true)}
            />
          ) : (
            <img
              src={image.src}
              alt={image.title}
              loading="lazy"
              onLoad={() => setIsLoaded(true)}
              className={`pin-card-image w-full h-full object-cover transition-all duration-500 ${
                isLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* 动态壁纸播放指示器（未悬停时显示） */}
          {isVideo && !isHovered && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
          )}

          {/* 动态壁纸标签 */}
          {isVideo && (
            <div className="absolute top-2 right-2">
              <span className="text-[10px] font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-1.5 py-0.5 rounded">
                LIVE
              </span>
            </div>
          )}

          {/* Mobile: Always visible favorite button */}
          <div className="sm:hidden absolute top-2 right-2 z-10">
            <button
              onClick={handleFavorite}
              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform ${
                isFavorited
                  ? "bg-[var(--color-primary)] text-white dark:bg-white dark:text-black"
                  : "bg-white/90 backdrop-blur-sm text-[var(--color-ink)]"
              }`}
            >
              <svg className="w-4 h-4" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          {/* Desktop: Hover Overlay */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50"
              >
                {/* Save Button - Top */}
                <div className="absolute top-3 left-3">
                  <button
                    onClick={handleFavorite}
                    className={`px-5 py-2 text-sm font-bold rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${
                      isFavorited
                        ? "bg-[var(--color-primary)] text-white dark:bg-white dark:text-black"
                        : "bg-white text-[var(--color-ink)] hover:bg-[var(--color-primary)] hover:text-white dark:hover:bg-white dark:hover:text-black"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {isFavorited ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          已收藏
                        </>
                      ) : (
                        "收藏"
                      )}
                    </span>
                  </button>
                </div>

                {/* Collection Button - Below Save */}
                <div className="absolute top-14 left-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddToCollectionOpen(true);
                    }}
                    className="w-9 h-9 bg-[var(--color-surface-card)] rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
                    title="加入合集"
                  >
                    <FolderPlus className="w-4 h-4 text-[var(--color-ink)]" />
                  </button>
                </div>

                {/* Top Right Actions */}
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={handleShare}
                    className="w-9 h-9 bg-[var(--color-surface-card)] rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
                    title="分享"
                  >
                    <svg className="w-4 h-4 text-[var(--color-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                    className="w-9 h-9 bg-[var(--color-surface-card)] rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
                    title="查看大图"
                  >
                    <svg className="w-4 h-4 text-[var(--color-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>

                {/* Bottom Info */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center">
                  <Link
                    href={image.uploaded_by ? `/creator/${image.uploaded_by}` : "#"}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center overflow-hidden ring-2 ring-white/50">
                      <img src={image.avatar} alt={image.author} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs font-semibold text-white drop-shadow-sm">{image.author}</span>
                    {image.author_level != null && (
                      <LevelBadge level={image.author_level} title={image.author_level_title || ""} size="sm" showTitle={false} />
                    )}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save Feedback Toast */}
          <AnimatePresence>
            {showSaveFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 bg-black/70 text-white text-sm font-medium rounded-full backdrop-blur-sm"
              >
                {isFavorited ? "已添加到收藏" : "已取消收藏"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pin Info (always visible below image) */}
        <div className="p-2 sm:p-3">
          <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] truncate">{image.title}</h3>
          <Link
            href={image.uploaded_by ? `/creator/${image.uploaded_by}` : "#"}
            className="text-[10px] sm:text-xs text-[var(--color-mute)] mt-0.5 truncate hover:text-[var(--color-primary)] transition-colors inline-flex items-center gap-1"
          >
            {image.author}
            {image.author_level != null && (
              <LevelBadge level={image.author_level} title={image.author_level_title || ""} size="sm" showTitle={false} />
            )}
          </Link>
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(Array.isArray(image.tags) ? image.tags : []).slice(0, 2).map((tag: string) => (
              <span
                key={tag}
                className="text-[10px] font-medium text-[var(--color-mute)] bg-[var(--color-surface-card)] px-2 py-0.5 rounded-full"
              >
                {tagLabels[tag] || tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Add to Collection Dialog */}
      <AddToCollectionDialog
        open={addToCollectionOpen}
        onOpenChange={setAddToCollectionOpen}
        imageId={image.id}
      />
    </motion.div>
  );
}