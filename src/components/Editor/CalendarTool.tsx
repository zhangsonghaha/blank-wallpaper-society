"use client";

import { CALENDAR_STYLES, type CalendarConfig } from "./types";
import { Calendar, RotateCcw } from "lucide-react";

interface CalendarToolProps {
  calendarConfig: CalendarConfig | null;
  onConfigChange: (config: CalendarConfig | null) => void;
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export default function CalendarTool({
  calendarConfig,
  onConfigChange,
}: CalendarToolProps) {
  const isEnabled = calendarConfig !== null;

  const toggleCalendar = () => {
    if (isEnabled) {
      onConfigChange(null);
    } else {
      onConfigChange({
        year: currentYear,
        month: currentMonth,
        style: "minimal",
        position: "bottom",
        opacity: 0.85,
        backgroundColor: "rgba(255,255,255,0.9)",
        textColor: "#333333",
        accentColor: "#e60023",
        showWeekNumbers: false,
        startOnMonday: true,
      });
    }
  };

  const updateConfig = (updates: Partial<CalendarConfig>) => {
    if (!calendarConfig) return;
    onConfigChange({ ...calendarConfig, ...updates });
  };

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink,#1a1a1a)]">
          <Calendar className="w-4 h-4" />
          日历壁纸
        </div>
        <div className="flex items-center gap-2">
          {isEnabled && (
            <button
              onClick={() => onConfigChange(null)}
              className="flex items-center gap-1 text-xs text-[var(--color-mute,#62625b)] hover:text-[var(--color-primary,#e60023)] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          )}
          <button
            onClick={toggleCalendar}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              isEnabled ? "bg-[var(--color-primary,#e60023)]" : "bg-[var(--color-hairline,#e5e5e0)]"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                isEnabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 配置面板 */}
      {isEnabled && calendarConfig && (
        <div className="space-y-4">
          {/* 年月选择 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">年份</label>
              <select
                value={calendarConfig.year}
                onChange={(e) => updateConfig({ year: parseInt(e.target.value) })}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-hairline,#e5e5e0)] text-xs bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#e60023)]"
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">月份</label>
              <select
                value={calendarConfig.month}
                onChange={(e) => updateConfig({ month: parseInt(e.target.value) })}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-hairline,#e5e5e0)] text-xs bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#e60023)]"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 样式选择 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">样式</label>
            <div className="grid grid-cols-3 gap-2">
              {CALENDAR_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateConfig({ style: s.value })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    calendarConfig.style === s.value
                      ? "bg-[var(--color-primary,#e60023)] text-white border-[var(--color-primary,#e60023)]"
                      : "bg-[var(--color-surface-card)] text-[var(--color-body,#33332e)] border-[var(--color-hairline,#e5e5e0)] hover:border-[var(--color-primary,#e60023)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 位置选择 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">位置</label>
            <div className="grid grid-cols-2 gap-2">
              {(["bottom", "right"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => updateConfig({ position: pos })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    calendarConfig.position === pos
                      ? "bg-[var(--color-primary,#e60023)] text-white border-[var(--color-primary,#e60023)]"
                      : "bg-[var(--color-surface-card)] text-[var(--color-body,#33332e)] border-[var(--color-hairline,#e5e5e0)] hover:border-[var(--color-primary,#e60023)]"
                  }`}
                >
                  {pos === "bottom" ? "底部" : "右侧"}
                </button>
              ))}
            </div>
          </div>

          {/* 透明度 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-mute,#62625b)]">透明度</span>
              <span className="text-[var(--color-mute,#62625b)] tabular-nums">
                {Math.round(calendarConfig.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={calendarConfig.opacity}
              onChange={(e) => updateConfig({ opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-[var(--color-hairline,#e5e5e0)] cursor-pointer accent-[var(--color-primary,#e60023)]"
            />
          </div>

          {/* 文字颜色 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">文字颜色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={calendarConfig.textColor}
                onChange={(e) => updateConfig({ textColor: e.target.value })}
                className="w-8 h-8 rounded-md border border-[var(--color-hairline,#e5e5e0)] cursor-pointer"
              />
              <input
                type="color"
                value={calendarConfig.accentColor}
                onChange={(e) => updateConfig({ accentColor: e.target.value })}
                className="w-8 h-8 rounded-md border border-[var(--color-hairline,#e5e5e0)] cursor-pointer"
                title="周末强调色"
              />
              <span className="text-[10px] text-[var(--color-ash,#91918c)]">文字 / 周末</span>
            </div>
          </div>

          {/* 周一开关 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-mute,#62625b)]">周一开始</span>
            <button
              onClick={() => updateConfig({ startOnMonday: !calendarConfig.startOnMonday })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                calendarConfig.startOnMonday ? "bg-[var(--color-primary,#e60023)]" : "bg-[var(--color-hairline,#e5e5e0)]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  calendarConfig.startOnMonday ? "left-4" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}