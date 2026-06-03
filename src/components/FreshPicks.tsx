"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Eye, Download, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

interface FreshImage {
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
  created_at: string;
  author_id: number | null;
  author_name: string | null;
  author_avatar: string | null;
  author_joined: string | null;
}

export default function FreshPicks() {
  const [images, setImages] = useState<FreshImage[]>([]);
  const [newCreatorCount, setNewCreatorCount] = useState(0);

  useEffect(() => {
    fetch("/api/discover/fresh-picks")
      .then((res) => res.json())
      .then((data) => {
        setImages(data.data || []);
        setNewCreatorCount(data.newCreatorCount || 0);
      })
      .catch(() => {});
  }, []);

  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
          新人专区
        </h2>
        {newCreatorCount > 0 && (
          <span className="text-xs text-[var(--color-mute)] flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" />
            近30天 {newCreatorCount} 位新创作者加入
          </span>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {images.map((img, index) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(index * 0.05, 0.3) }}
          >
            <Link
              href={`/images/${img.id}`}
              className="group block shrink-0 w-36 sm:w-44"
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--color-surface-card)]">
                <img
                  src={img.thumbnail_url || img.url}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-xs text-white font-medium truncate">{img.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-white/70">
                    <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{img.view_count}</span>
                    <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" />{img.download_count}</span>
                  </div>
                </div>
                {/* 新人标识 */}
                {img.author_joined && (
                  <div className="absolute top-2 left-2">
                    <span className="px-1.5 py-0.5 bg-[var(--color-primary)] dark:bg-white text-white dark:text-black text-[9px] font-bold rounded-full">
                      NEW
                    </span>
                  </div>
                )}
              </div>
              {/* 作者信息 */}
              {img.author_name && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 mt-2 px-1 hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `/user/${img.author_id}`;
                  }}
                >
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={img.author_avatar || ""} />
                    <AvatarFallback className="text-[8px] bg-[var(--color-primary)] dark:bg-white text-white dark:text-black">
                      {img.author_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-[var(--color-mute)] truncate">{img.author_name}</span>
                </button>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}