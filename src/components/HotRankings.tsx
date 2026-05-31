"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Trophy, ChevronRight, Download, Eye } from "lucide-react";

interface RankingItem {
  rank: number;
  id: number;
  title: string;
  thumbnail_url: string | null;
  url: string;
  download_count: number;
  view_count: number;
  category: string;
}

export default function HotRankings() {
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/rankings?period=weekly&type=downloads")
      .then((res) => res.json())
      .then((data) => setRankings((data.data || []).slice(0, 10)))
      .catch(() => {});
  }, []);

  if (rankings.length === 0) return null;

  const getMedalColor = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white";
    if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-500 text-white";
    if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-800 text-white";
    return "bg-[var(--color-surface-card)] text-[var(--color-mute)]";
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[var(--color-primary)]" />
          热门排行
        </h2>
        <Link
          href="/rankings"
          className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium hover:underline"
        >
          查看全部
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {rankings.map((item) => (
          <Link
            key={item.id}
            href={`/images/${item.id}`}
            className="shrink-0 w-36 group"
          >
            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--color-surface-card)]">
              <img
                src={item.thumbnail_url || item.url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              {/* Rank Badge */}
              <div
                className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${getMedalColor(item.rank)}`}
              >
                {item.rank}
              </div>
              {/* Stats */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 text-white/90 text-[10px]">
                <span className="flex items-center gap-0.5">
                  <Download className="w-2.5 h-2.5" />
                  {item.download_count}
                </span>
                <span className="flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  {item.view_count}
                </span>
              </div>
            </div>
            <h3 className="mt-1.5 text-xs font-medium text-[var(--color-ink)] truncate">
              {item.title}
            </h3>
          </Link>
        ))}
      </div>
    </div>
  );
}