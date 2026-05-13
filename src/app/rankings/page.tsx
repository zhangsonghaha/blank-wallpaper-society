"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Trophy,
  Download,
  Eye,
  Heart,
  ArrowLeft,
  Medal,
  Flame,
  Calendar,
} from "lucide-react";

interface RankingItem {
  rank: number;
  id: number;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  author: string;
  tags: string;
  category: string;
  download_count: number;
  view_count: number;
  favorite_count: number;
  log_count: number;
}

const periods = [
  { value: "daily", label: "日榜", icon: Flame },
  { value: "weekly", label: "周榜", icon: Calendar },
  { value: "monthly", label: "月榜", icon: Calendar },
  { value: "all", label: "总榜", icon: Trophy },
];

const types = [
  { value: "downloads", label: "下载榜", icon: Download },
  { value: "views", label: "浏览榜", icon: Eye },
  { value: "favorites", label: "收藏榜", icon: Heart },
];

export default function RankingsPage() {
  const [activePeriod, setActivePeriod] = useState("weekly");
  const [activeType, setActiveType] = useState("downloads");
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/rankings?period=${activePeriod}&type=${activeType}`)
      .then((res) => res.json())
      .then((data) => {
        setRankings(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activePeriod, activeType]);

  const getRankBadge = (rank: number) => {
    if (rank === 1)
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-yellow-400/30">
          1
        </div>
      );
    if (rank === 2)
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-gray-400/30">
          2
        </div>
      );
    if (rank === 3)
      return (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-amber-600/30">
          3
        </div>
      );
    return (
      <div className="w-8 h-8 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center text-[var(--color-mute)] font-bold text-sm">
        {rank}
      </div>
    );
  };

  const getTopCardStyle = (rank: number) => {
    if (rank === 1) return "border-yellow-400/50 bg-gradient-to-r from-yellow-50/80 to-transparent dark:from-yellow-900/20";
    if (rank === 2) return "border-gray-300/50 bg-gradient-to-r from-gray-50/80 to-transparent dark:from-gray-800/20";
    if (rank === 3) return "border-amber-600/50 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-900/20";
    return "border-[var(--color-hairline)] bg-[var(--color-canvas)]";
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-soft)]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--color-canvas)]/80 backdrop-blur-xl border-b border-[var(--color-hairline)]">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
          <div className="flex items-center gap-4 h-14">
            <Link
              href="/"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-soft)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--color-ink)]" />
            </Link>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[var(--color-primary)]" />
              <h1 className="text-lg font-bold text-[var(--color-ink)]">
                排行榜
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {/* Period Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {periods.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.value}
                onClick={() => setActivePeriod(p.value)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full transition-all ${
                  activePeriod === p.value
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Type Tabs */}
        <div className="flex items-center gap-2 mb-8">
          {types.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setActiveType(t.value)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  activeType === t.value
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Top 3 Highlight */}
        {rankings.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* #2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="order-2 md:order-1"
            >
              <TopThreeCard item={rankings[1]} />
            </motion.div>
            {/* #1 */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              className="order-1 md:order-2"
            >
              <TopThreeCard item={rankings[0]} isChampion />
            </motion.div>
            {/* #3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="order-3"
            >
              <TopThreeCard item={rankings[2]} />
            </motion.div>
          </div>
        )}

        {/* Ranking List */}
        <div className="space-y-2">
          <AnimatePresence mode="wait">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl skeleton-pulse bg-[var(--color-surface-card)]"
                  />
                ))}
              </div>
            ) : rankings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <Medal className="w-12 h-12 text-[var(--color-ash)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-2">
                  暂无排行数据
                </h3>
                <p className="text-[var(--color-mute)]">
                  还没有足够的数据生成排行榜
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={activePeriod + activeType}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {rankings.slice(3).map((item) => (
                  <Link
                    key={item.id}
                    href={`/?pin=${item.id}`}
                    className={`flex items-center gap-4 p-3 rounded-2xl border transition-all hover:shadow-md hover:scale-[1.01] ${getTopCardStyle(item.rank)}`}
                  >
                    {getRankBadge(item.rank)}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--color-surface-card)] shrink-0">
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-[var(--color-ink)] truncate">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[var(--color-mute)] truncate">
                        {item.author} · {item.category || "未分类"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-ash)] shrink-0">
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        {item.download_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {item.favorite_count}
                      </span>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {rankings.length > 0 && (
          <div className="text-center mt-8 text-sm text-[var(--color-ash)]">
            共 {rankings.length} 张壁纸上榜
          </div>
        )}
      </div>
    </div>
  );
}

// Top 3 特殊卡片组件
function TopThreeCard({
  item,
  isChampion = false,
}: {
  item: RankingItem;
  isChampion?: boolean;
}) {
  const borderColors = {
    1: "border-yellow-400/60",
    2: "border-gray-300/60",
    3: "border-amber-600/60",
  };

  const medalColors = {
    1: "from-yellow-400 to-yellow-600 shadow-yellow-400/40",
    2: "from-gray-300 to-gray-500 shadow-gray-400/40",
    3: "from-amber-600 to-amber-800 shadow-amber-600/40",
  };

  const borderColor =
    borderColors[item.rank as keyof typeof borderColors] ||
    "border-[var(--color-hairline)]";
  const medalColor =
    medalColors[item.rank as keyof typeof medalColors] ||
    "from-gray-300 to-gray-500";

  return (
    <Link href={`/?pin=${item.id}`} className="block group">
      <div
        className={`relative rounded-2xl border-2 ${borderColor} overflow-hidden bg-[var(--color-canvas)] transition-all group-hover:shadow-lg group-hover:scale-[1.02]`}
      >
        {/* Image */}
        <div
          className={`relative overflow-hidden ${
            isChampion ? "aspect-[4/3]" : "aspect-[4/3]"
          }`}
        >
          <img
            src={item.thumbnail_url || item.url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Rank Badge */}
          <div
            className={`absolute top-3 left-3 w-10 h-10 rounded-full bg-gradient-to-br ${medalColor} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
          >
            {item.rank}
          </div>

          {/* Stats */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 text-white/90 text-xs">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {item.download_count}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {item.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {item.favorite_count}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] truncate">
            {item.title}
          </h3>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            {item.author}
          </p>
        </div>
      </div>
    </Link>
  );
}