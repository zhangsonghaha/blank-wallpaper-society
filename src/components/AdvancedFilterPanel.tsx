"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter,
  X,
  Ruler,
  Calendar,
  Tag,
  Palette,
  SortAsc,
  RotateCcw,
} from "lucide-react";
import { useSearch, type ResolutionFilter, type DateFilter } from "@/context/SearchContext";
import ColorSearch from "./ColorSearch";

interface AdvancedFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// 常用分辨率预设
const RESOLUTION_PRESETS = [
  { label: "手机 (1080×1920)", width: 1080, height: 1920 },
  { label: "平板 (1536×2048)", width: 1536, height: 2048 },
  { label: "桌面 (1920×1080)", width: 1920, height: 1080 },
  { label: "2K (2560×1440)", width: 2560, height: 1440 },
  { label: "4K (3840×2160)", width: 3840, height: 2160 },
];

// 常用日期范围预设
const DATE_PRESETS = [
  { label: "今天", days: 1 },
  { label: "本周", days: 7 },
  { label: "本月", days: 30 },
  { label: "今年", days: 365 },
];

// 排序选项
const SORT_OPTIONS = [
  { value: "latest", label: "最新上传" },
  { value: "popular", label: "最多浏览" },
  { value: "downloads", label: "最多下载" },
  { value: "favorites", label: "最多收藏" },
];

export default function AdvancedFilterPanel({
  isOpen,
  onClose,
}: AdvancedFilterPanelProps) {
  const {
    resolutionFilter,
    setResolutionFilter,
    dateFilter,
    setDateFilter,
    sortBy,
    setSortBy,
    activeColor,
    setActiveColor,
    colorThreshold,
    setColorThreshold,
    resetFilters,
  } = useSearch();

  // 本地临时状态，确认后再同步到 context
  const [localResolution, setLocalResolution] = useState<ResolutionFilter>({
    ...resolutionFilter,
  });
  const [localDate, setLocalDate] = useState<DateFilter>({ ...dateFilter });
  const [localSort, setLocalSort] = useState(sortBy);
  const [localColor, setLocalColor] = useState(activeColor);
  const [localColorThreshold, setLocalColorThreshold] = useState(colorThreshold);

  // 应用筛选
  const applyFilters = () => {
    setResolutionFilter(localResolution);
    setDateFilter(localDate);
    setSortBy(localSort as any);
    setActiveColor(localColor);
    setColorThreshold(localColorThreshold);
    onClose();
  };

  // 重置所有筛选
  const handleReset = () => {
    resetFilters();
    setLocalResolution({ minWidth: null, maxWidth: null, minHeight: null, maxHeight: null });
    setLocalDate({ from: null, to: null });
    setLocalSort("latest");
    setLocalColor(null);
    setLocalColorThreshold(30);
  };

  // 设置分辨率预设
  const applyResolutionPreset = (width: number, height: number) => {
    setLocalResolution({
      minWidth: width,
      maxWidth: null,
      minHeight: height,
      maxHeight: null,
    });
  };

  // 设置日期预设
  const applyDatePreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    setLocalDate({
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[380px] bg-[var(--color-surface-card)] shadow-2xl z-[60] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-hairline)]">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-[var(--color-ink)]" />
                <h3 className="text-lg font-bold text-[var(--color-ink)]">高级筛选</h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-mute)]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* 分辨率筛选 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                  <Ruler className="w-4 h-4" />
                  分辨率筛选
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyResolutionPreset(preset.width, preset.height)}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--color-surface-card)] hover:bg-[var(--color-secondary-bg)] transition-colors text-[var(--color-ink)] font-medium"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-mute)]">最小宽度</label>
                    <input
                      type="number"
                      value={localResolution.minWidth || ""}
                      onChange={(e) =>
                        setLocalResolution({
                          ...localResolution,
                          minWidth: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="px"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border-0 text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-mute)]">最大宽度</label>
                    <input
                      type="number"
                      value={localResolution.maxWidth || ""}
                      onChange={(e) =>
                        setLocalResolution({
                          ...localResolution,
                          maxWidth: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="px"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border-0 text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-mute)]">最小高度</label>
                    <input
                      type="number"
                      value={localResolution.minHeight || ""}
                      onChange={(e) =>
                        setLocalResolution({
                          ...localResolution,
                          minHeight: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="px"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border-0 text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-mute)]">最大高度</label>
                    <input
                      type="number"
                      value={localResolution.maxHeight || ""}
                      onChange={(e) =>
                        setLocalResolution({
                          ...localResolution,
                          maxHeight: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      placeholder="px"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border-0 text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-[var(--color-hairline-soft)]" />

              {/* 日期范围筛选 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                  <Calendar className="w-4 h-4" />
                  上传日期
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyDatePreset(preset.days)}
                      className="px-3 py-2 text-xs rounded-xl bg-[var(--color-surface-card)] hover:bg-[var(--color-secondary-bg)] transition-colors text-[var(--color-ink)] font-medium"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-mute)]">开始日期</label>
                    <input
                      type="date"
                      value={localDate.from || ""}
                      onChange={(e) =>
                        setLocalDate({
                          ...localDate,
                          from: e.target.value || null,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border-0 text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-[var(--color-mute)]">结束日期</label>
                    <input
                      type="date"
                      value={localDate.to || ""}
                      onChange={(e) =>
                        setLocalDate({
                          ...localDate,
                          to: e.target.value || null,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border-0 text-sm focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-[var(--color-hairline-soft)]" />

              {/* 颜色筛选 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                  <Palette className="w-4 h-4" />
                  颜色筛选
                </div>

                <ColorSearch
                  activeColor={localColor}
                  onColorSelect={(color) => setLocalColor(color)}
                />

                {localColor && (
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--color-mute)] flex items-center justify-between">
                      <span>颜色匹配度</span>
                      <span className="font-medium">{localColorThreshold}%</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      value={localColorThreshold}
                      onChange={(e) => setLocalColorThreshold(Number(e.target.value))}
                      className="w-full accent-[var(--color-primary)]"
                    />
                  </div>
                )}
              </div>

              <div className="h-px bg-[var(--color-hairline-soft)]" />

              {/* 排序方式 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-ink)]">
                  <SortAsc className="w-4 h-4" />
                  排序方式
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLocalSort(option.value as any)}
                      className={`px-4 py-2 text-sm rounded-xl transition-colors font-medium ${
                        localSort === option.value
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[var(--color-hairline)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-surface-card)] text-[var(--color-ink)] font-bold hover:bg-[var(--color-secondary-bg)] transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置
                </button>
                <button
                  onClick={applyFilters}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-pressed)] transition-colors"
                >
                  应用筛选
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}