"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ChevronRight, Download } from "lucide-react";

interface RecommendItem {
  id: number;
  title: string;
  thumbnail_url: string | null;
  url: string;
  download_count: number;
  view_count: number;
  category: string;
  author: string;
}

export default function RecommendForYou() {
  const [recommendations, setRecommendations] = useState<RecommendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations?limit=10")
      .then((res) => res.json())
      .then((data) => {
        setRecommendations(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (!loading && recommendations.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
          猜你喜欢
        </h2>
        <Link
          href="/rankings"
          className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium hover:underline"
        >
          换一批
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-44">
              <div className="aspect-[3/4] rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
              <div className="mt-1.5 h-3 w-3/4 rounded skeleton-pulse bg-[var(--color-surface-card)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {recommendations.map((item) => (
            <Link
              key={item.id}
              href={`/?pin=${item.id}`}
              className="group"
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--color-surface-card)]">
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {/* Category Tag */}
                {item.category && (
                  <div className="absolute top-2 right-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-white/90 backdrop-blur-sm">
                      {item.category}
                    </span>
                  </div>
                )}
                {/* Download count on hover */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-0.5 text-[10px] text-white/90">
                    <Download className="w-2.5 h-2.5" />
                    {item.download_count}
                  </span>
                </div>
              </div>
              <h3 className="mt-1.5 text-xs font-medium text-[var(--color-ink)] truncate">
                {item.title}
              </h3>
              <p className="text-[10px] text-[var(--color-mute)] truncate">
                {item.author}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}