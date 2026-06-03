"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette } from "lucide-react";

// 预设颜色网格（常用壁纸颜色）
const PRESET_COLORS = [
  // 红色系
  { color: "#E60023", label: "红色" },
  { color: "#FF4444", label: "亮红" },
  { color: "#CC3333", label: "深红" },
  // 橙色系
  { color: "#FF6600", label: "橙色" },
  { color: "#FF9933", label: "浅橙" },
  // 黄色系
  { color: "#FFCC00", label: "黄色" },
  { color: "#FFD700", label: "金色" },
  // 绿色系
  { color: "#009933", label: "绿色" },
  { color: "#33CC66", label: "浅绿" },
  { color: "#006633", label: "深绿" },
  // 蓝色系
  { color: "#0066CC", label: "蓝色" },
  { color: "#3399FF", label: "浅蓝" },
  { color: "#003366", label: "深蓝" },
  // 紫色系
  { color: "#6633CC", label: "紫色" },
  { color: "#9966FF", label: "浅紫" },
  // 粉色系
  { color: "#FF66CC", label: "粉色" },
  { color: "#FFB6C1", label: "浅粉" },
  // 棕色系
  { color: "#8B4513", label: "棕色" },
  { color: "#D2691E", label: "浅棕" },
  // 黑白灰
  { color: "#000000", label: "黑色" },
  { color: "#333333", label: "深灰" },
  { color: "#999999", label: "灰色" },
  { color: "#CCCCCC", label: "浅灰" },
  { color: "#FFFFFF", label: "白色" },
];

interface ColorSearchProps {
  activeColor: string | null;
  onColorSelect: (color: string | null) => void;
}

export default function ColorSearch({
  activeColor,
  onColorSelect,
}: ColorSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#E60023");
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleColorClick = (color: string) => {
    if (activeColor === color) {
      onColorSelect(null); // 取消选择
    } else {
      onColorSelect(color);
    }
    setIsOpen(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value.toUpperCase();
    setCustomColor(hex);
  };

  const handleCustomColorConfirm = () => {
    onColorSelect(customColor);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-full transition-all ${
          activeColor
            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
            : "bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:bg-[var(--color-secondary-bg)]"
        }`}
      >
        {activeColor ? (
          <span
            className="w-4 h-4 rounded-full border border-[var(--color-hairline-soft)]"
            style={{ backgroundColor: activeColor }}
          />
        ) : (
          <Palette className="w-4 h-4" />
        )}
        {activeColor ? "按颜色筛选" : "颜色"}
      </button>

      {/* 颜色选择弹出层 */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="absolute top-full left-0 mt-2 z-50 bg-[var(--color-canvas)] rounded-2xl shadow-lg border border-[var(--color-hairline-soft)] p-4 w-[280px]"
            >
              {/* 标题 */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-[var(--color-ink)]">
                  选择颜色
                </span>
                {activeColor && (
                  <button
                    onClick={() => {
                      onColorSelect(null);
                      setIsOpen(false);
                    }}
                    className="text-xs text-[var(--color-mute)] hover:text-[var(--color-primary)] transition-colors"
                  >
                    清除筛选
                  </button>
                )}
              </div>

              {/* 预设颜色网格 */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {PRESET_COLORS.map(({ color, label }) => (
                  <button
                    key={color}
                    onClick={() => handleColorClick(color)}
                    title={label}
                    className={`relative w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95 ${
                      activeColor === color
                        ? "ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-canvas)]"
                        : ""
                    }`}
                    style={{
                      backgroundColor: color,
                      border:
                        color === "#FFFFFF"
                          ? "1px solid var(--color-hairline-soft)"
                          : "none",
                    }}
                  >
                    {activeColor === color && (
                      <svg
                        className="absolute inset-0 m-auto w-4 h-4"
                        fill={
                          color === "#FFFFFF" || color === "#CCCCCC"
                            ? "#000"
                            : "#fff"
                        }
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* 自定义颜色选择器 */}
              <div className="border-t border-[var(--color-hairline-soft)] pt-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => colorInputRef.current?.click()}
                      className="w-10 h-10 rounded-xl border-2 border-dashed border-[var(--color-hairline-soft)] flex items-center justify-center hover:border-[var(--color-primary)] transition-colors"
                    >
                      <span
                        className="w-6 h-6 rounded-md"
                        style={{ backgroundColor: customColor }}
                      />
                    </button>
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={customColor}
                      onChange={handleCustomColorChange}
                      className="absolute opacity-0 w-0 h-0"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-mute)] mb-1">
                      自定义颜色
                    </p>
                    <p className="text-sm font-mono font-bold text-[var(--color-ink)]">
                      {customColor}
                    </p>
                  </div>
                  <button
                    onClick={handleCustomColorConfirm}
                    className="px-3 py-1.5 text-xs font-bold rounded-full bg-[var(--color-primary)] text-white dark:bg-white dark:text-black hover:bg-[var(--color-primary-pressed)] transition-colors"
                  >
                    搜索
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}