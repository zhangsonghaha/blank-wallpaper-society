"use client";

import { FILTER_PRESETS, type FilterConfig, type FilterValues } from "./types";
import { Sparkles, RotateCcw } from "lucide-react";

interface FilterToolProps {
  activeFilter: FilterConfig;
  filterValues: FilterValues;
  imageUrl: string;
  onFilterChange: (filter: FilterConfig) => void;
  onFilterValuesChange: (values: FilterValues) => void;
  onReset: () => void;
}

function buildFilterCSS(filter: FilterConfig, values: FilterValues): string {
  if (!filter.css) return "none";
  let css = filter.css;
  for (const param of filter.params) {
    const val = values[param.key] ?? param.default;
    css = css.replace(`{${param.key}}`, String(val));
  }
  return css;
}

export default function FilterTool({
  activeFilter,
  filterValues,
  imageUrl,
  onFilterChange,
  onFilterValuesChange,
  onReset,
}: FilterToolProps) {
  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink,#1a1a1a)]">
          <Sparkles className="w-4 h-4" />
          滤镜
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-[var(--color-mute,#62625b)] hover:text-[var(--color-primary,#e60023)] transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          重置
        </button>
      </div>

      {/* 滤镜预览列表 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">预设</label>
        <div className="grid grid-cols-4 gap-2">
          {FILTER_PRESETS.map((filter) => {
            const isActive = activeFilter.name === filter.name;
            const previewCSS = buildFilterCSS(filter, filterValues);
            return (
              <button
                key={filter.name}
                onClick={() => onFilterChange(filter)}
                className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg transition-all border ${
                  isActive
                    ? "border-[var(--color-primary,#e60023)] bg-[var(--color-primary,#e60023)]/5"
                    : "border-transparent hover:bg-[var(--color-surface-soft,#f5f5f5)]"
                }`}
              >
                <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surface-soft,#f5f5f5)]">
                  <img
                    src={imageUrl}
                    alt={filter.label}
                    className="w-full h-full object-cover"
                    style={{ filter: previewCSS || "none" }}
                    crossOrigin="anonymous"
                  />
                </div>
                <span className={`text-[10px] font-medium ${isActive ? "text-[var(--color-primary,#e60023)]" : "text-[var(--color-mute,#62625b)]"}`}>
                  {filter.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 参数调节 */}
      {activeFilter.params.length > 0 && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">参数调节</label>
          {activeFilter.params.map((param) => {
            const value = filterValues[param.key] ?? param.default;
            return (
              <div key={param.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-body,#33332e)]">{param.label}</span>
                  <span className="text-[var(--color-mute,#62625b)] tabular-nums">
                    {value}{param.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={value}
                  onChange={(e) => {
                    onFilterValuesChange({
                      ...filterValues,
                      [param.key]: parseFloat(e.target.value),
                    });
                  }}
                  className="w-full h-1.5 rounded-full appearance-none bg-[var(--color-hairline,#e5e5e0)] cursor-pointer accent-[var(--color-primary,#e60023)]"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}