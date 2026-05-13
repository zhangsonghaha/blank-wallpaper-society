"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GalleryImage } from "@/data/images";

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

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(image.id);
    setShowSaveFeedback(true);
    setTimeout(() => setShowSaveFeedback(false), 1500);
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div className="relative rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-surface-card)] shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Image */}
        <div className="relative" style={{ aspectRatio: `${image.width}/${image.height}` }}>
          {/* Loading Skeleton */}
          {!isLoaded && (
            <div className="absolute inset-0 skeleton-pulse bg-[var(--color-surface-card)]" />
          )}

          <img
            src={image.src}
            alt={image.title}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            className={`pin-card-image w-full h-full object-cover transition-all duration-500 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Hover Overlay */}
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
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-white text-[var(--color-ink)] hover:bg-[var(--color-primary)] hover:text-white"
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

                {/* Top Right Actions */}
                <div className="absolute top-3 right-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Share functionality
                    }}
                    className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
                  >
                    <svg className="w-4 h-4 text-[var(--color-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </button>
                </div>

                {/* Bottom Info */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center overflow-hidden ring-2 ring-white/50">
                      <img src={image.avatar} alt={image.author} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs font-semibold text-white drop-shadow-sm">{image.author}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick();
                    }}
                    className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
                  >
                    <svg className="w-4 h-4 text-[var(--color-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
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
        <div className="p-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] truncate">{image.title}</h3>
          <p className="text-xs text-[var(--color-mute)] mt-0.5 truncate">{image.author}</p>
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {image.tags.slice(0, 2).map((tag) => (
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
    </motion.div>
  );
}