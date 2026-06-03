"use client";

import { motion } from "framer-motion";
import {
  Upload,
  Download,
  Heart,
  Trophy,
  Star,
  Users,
  Calendar,
  Flame,
  Bookmark,
  Award,
} from "lucide-react";

interface AchievementCardProps {
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  expReward: number;
  currentValue?: number;
  conditionValue: number;
}

const iconMap: Record<string, React.ElementType> = {
  upload: Upload,
  download: Download,
  heart: Heart,
  trophy: Trophy,
  star: Star,
  users: Users,
  calendar: Calendar,
  flame: Flame,
  bookmark: Bookmark,
  award: Award,
};

export default function AchievementCard({
  name,
  description,
  icon,
  unlocked,
  unlockedAt,
  progress = 0,
  expReward,
  currentValue = 0,
  conditionValue,
}: AchievementCardProps) {
  const IconComponent = iconMap[icon] || Award;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-xl p-4 border transition-all duration-300 ${
        unlocked
          ? "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200 shadow-sm hover:shadow-md dark:from-amber-900/20 dark:to-yellow-900/20 dark:border-amber-800"
          : "bg-[var(--color-surface-card)] border-[var(--color-hairline)] opacity-70 hover:opacity-90"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* 图标 */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            unlocked
              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md"
              : "bg-[var(--color-secondary-bg)] text-[var(--color-mute)]"
          }`}
        >
          <IconComponent className="w-5 h-5" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4
              className={`text-sm font-semibold ${
                unlocked ? "text-amber-800 dark:text-amber-400" : "text-gray-500 dark:text-[var(--color-mute)]"
              }`}
            >
              {name}
            </h4>
            {unlocked && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium dark:bg-amber-900/20 dark:text-amber-400">
                +{expReward} EXP
              </span>
            )}
          </div>

          <p className={`text-xs ${unlocked ? "text-amber-600 dark:text-amber-400" : "text-[var(--color-mute)]"}`}>
            {description}
          </p>

          {!unlocked && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)] mb-1">
                <span>{currentValue} / {conditionValue}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-[var(--color-secondary-bg)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                />
              </div>
            </div>
          )}

          {unlocked && unlockedAt && (
            <p className="text-[10px] text-amber-500 dark:text-amber-400 mt-1">
              解锁于 {new Date(unlockedAt).toLocaleDateString("zh-CN")}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}