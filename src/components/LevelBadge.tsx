"use client";

import { motion } from "framer-motion";

interface LevelBadgeProps {
  level: number;
  title: string;
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
}

// 等级颜色配置：L1-3 铜色, L4-6 银色, L7-9 金色, L10 钻石色
function getLevelStyle(level: number) {
  if (level >= 10) {
    return {
      bg: "bg-gradient-to-br from-cyan-300 via-blue-400 to-purple-500",
      border: "border-cyan-300/60",
      shadow: "shadow-[0_0_12px_rgba(100,200,255,0.5)]",
      text: "text-white",
      ring: "ring-2 ring-cyan-300/40",
    };
  }
  if (level >= 7) {
    return {
      bg: "bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500",
      border: "border-yellow-400/60",
      shadow: "shadow-[0_0_10px_rgba(255,200,0,0.4)]",
      text: "text-amber-900",
      ring: "ring-2 ring-yellow-400/40",
    };
  }
  if (level >= 4) {
    return {
      bg: "bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400",
      border: "border-gray-300/60 dark:border-gray-600/60",
      shadow: "shadow-[0_0_8px_rgba(180,180,200,0.3)]",
      text: "text-gray-700 dark:text-gray-300",
      ring: "ring-2 ring-gray-300/40 dark:ring-gray-600/40",
    };
  }
  return {
    bg: "bg-gradient-to-br from-amber-500 via-orange-600 to-red-700",
    border: "border-amber-600/60",
    shadow: "shadow-[0_0_6px_rgba(200,120,50,0.3)]",
    text: "text-white",
    ring: "ring-2 ring-amber-500/30",
  };
}

const sizeConfig = {
  sm: { badge: "w-5 h-5 text-[9px]", font: "text-[9px]", gap: "gap-1" },
  md: { badge: "w-8 h-8 text-xs", font: "text-xs", gap: "gap-1.5" },
  lg: { badge: "w-12 h-12 text-base", font: "text-sm", gap: "gap-2" },
};

export default function LevelBadge({ level, title, size = "md", showTitle = true }: LevelBadgeProps) {
  const style = getLevelStyle(level);
  const sz = sizeConfig[size];

  return (
    <div className={`inline-flex items-center ${sz.gap}`}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className={`${sz.badge} ${style.bg} ${style.border} ${style.shadow} ${style.ring} rounded-full flex items-center justify-center font-bold ${style.text} border select-none`}
      >
        {level}
      </motion.div>
      {showTitle && (
        <span className={`${sz.font} font-semibold text-[var(--color-ink)]`}>{title}</span>
      )}
    </div>
  );
}