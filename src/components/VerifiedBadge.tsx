"use client";

import { BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
  showTooltip?: boolean;
}

/**
 * 认证创作者标识徽章
 * 在用户名旁显示蓝色认证勾图标
 */
export default function VerifiedBadge({
  size = 16,
  className = "",
  showTooltip = true,
}: VerifiedBadgeProps) {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex items-center ${showTooltip ? "group relative" : ""} ${className}`}
      title={showTooltip ? "认证创作者" : undefined}
    >
      <BadgeCheck
        size={size}
        className="fill-blue-500 text-white"
        strokeWidth={1.5}
      />
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          认证创作者
        </span>
      )}
    </motion.span>
  );
}