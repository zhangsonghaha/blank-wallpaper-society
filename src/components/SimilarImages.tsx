"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";

interface SimilarImagesProps {
  imageId: number;
  isOpen: boolean;
  onClose: () => void;
  onImageClick?: (image: any) => void;
}

export default function SimilarImages({
  imageId,
  isOpen,
  onClose,
  onImageClick,
}: SimilarImagesProps) {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isOpen || !imageId) return;

    setLoading(true);
    setImgErrors(new Set());
    fetch(`/api/images/${imageId}/similar`)
      .then((res) => res.json())
      .then((data) => {
        setImages(data.data || []);
        setLoading(false);
      })
      .catch(() => {
        setImages([]);
        setLoading(false);
      });
  }, [isOpen, imageId]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const getImgSrc = (img: any) => {
    // 优先使用API预处理好的display_url（已走代理）
    if (img.display_url) return img.display_url;
    // 回退：直接用thumbnail或url
    if (imgErrors.has(img.id)) {
      const rawUrl = img.thumbnail_url || img.url;
      return rawUrl ? `/api/proxy-image?url=${encodeURIComponent(rawUrl)}` : "";
    }
    return img.thumbnail_url || img.url || "";
  };

  const handleImgError = (imgId: number) => {
    setImgErrors((prev) => {
      if (prev.has(imgId)) return prev;
      const next = new Set(prev);
      next.add(imgId);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 半透明遮罩 - 仅覆盖右侧面板区域 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[101] bg-black/20"
            onClick={onClose}
          />

          {/* 面板主体 */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-[400px] max-w-[90vw] bg-white shadow-2xl z-[102] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  相似壁纸
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-mute)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
                  <span className="ml-2 text-sm text-[var(--color-mute)]">
                    查找相似壁纸...
                  </span>
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => onImageClick?.(img)}
                      className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 hover:shadow-md transition-shadow"
                    >
                      <img
                        src={getImgSrc(img)}
                        alt={img.title || "壁纸"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={() => handleImgError(img.id)}
                      />
                      {/* 底部信息 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-xs text-white font-medium truncate">
                          {img.title}
                        </p>
                        {img.author && (
                          <p className="text-[10px] text-white/70 truncate">
                            {img.author}
                          </p>
                        )}
                      </div>
                      {/* 匹配类型角标 */}
                      {img.match_type === "same_category" && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/80 text-white font-medium">
                          同类
                        </span>
                      )}
                      {img.match_type === "same_color" && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/80 text-white font-medium">
                          同色
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-mute)]">
                    暂无相似壁纸推荐
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}