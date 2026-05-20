"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Eye, Download } from "lucide-react";
import Link from "next/link";

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
}

interface ThemeZone {
  key: string;
  title: string;
  subtitle: string;
  category: string;
  icon: string;
  images: ZoneImage[];
  total: number;
}

export default function ThemeZones() {
  const [zones, setZones] = useState<ThemeZone[]>([]);

  useEffect(() => {
    fetch("/api/discover/theme-zones")
      .then((res) => res.json())
      .then((data) => setZones(data.data || []))
      .catch(() => {});
  }, []);

  if (zones.length === 0) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
          🎯 主题专区
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zones.map((zone, zoneIndex) => (
          <motion.div
            key={zone.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: zoneIndex * 0.1 }}
            className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-surface-card)] overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* 专区头部 */}
            <Link
              href={`/?category=${zone.category}`}
              className="flex items-center justify-between p-4 hover:bg-[var(--color-surface-soft)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{zone.icon}</span>
                <div>
                  <h3 className="font-semibold text-[var(--color-ink)]">{zone.title}</h3>
                  <p className="text-xs text-[var(--color-mute)]">{zone.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-[var(--color-primary)]">
                <span>{zone.total}张</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>

            {/* 专区图片网格 */}
            <div className="grid grid-cols-3 gap-1 p-1">
              {zone.images.slice(0, 6).map((img) => (
                <Link
                  key={img.id}
                  href={`/?pin=${img.id}`}
                  className="group relative aspect-square overflow-hidden"
                >
                  <img
                    src={img.thumbnail_url || img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white font-medium truncate">{img.title}</p>
                    <div className="flex items-center gap-2 text-[8px] text-white/80">
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{img.view_count}</span>
                      <span className="flex items-center gap-0.5"><Download className="w-2.5 h-2.5" />{img.download_count}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}