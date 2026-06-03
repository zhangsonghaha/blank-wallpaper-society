"use client";

import type { ToolType } from "./types";
import { Crop, Sparkles, Type, Calendar, Undo2, Redo2, Download, ArrowLeft } from "lucide-react";

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onBack: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isExporting: boolean;
}

const TOOLS: { type: ToolType; icon: typeof Crop; label: string }[] = [
  { type: "crop", icon: Crop, label: "裁剪" },
  { type: "filter", icon: Sparkles, label: "滤镜" },
  { type: "text", icon: Type, label: "文字" },
  { type: "calendar", icon: Calendar, label: "日历" },
];

export default function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onExport,
  onBack,
  canUndo,
  canRedo,
  isExporting,
}: ToolbarProps) {
  return (
    <>
      {/* 顶部操作栏 */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-hairline,#e5e5e0)] bg-[var(--color-surface-card)]">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded-lg text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--color-primary,#e60023)] text-white hover:bg-[var(--color-primary-pressed,#cc001f)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isExporting ? "导出中..." : "导出"}
        </button>
      </div>

      {/* 底部/侧边工具选择栏 - 桌面端在右侧，移动端在底部 */}
      <div className="md:w-64 border-l border-[var(--color-hairline,#e5e5e0)] bg-[var(--color-surface-card)] flex flex-col overflow-hidden">
        {/* 工具选择标签 */}
        <div className="flex md:flex-col border-b border-[var(--color-hairline,#e5e5e0)] md:border-b-0 md:border-r-0">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.type;
            return (
              <button
                key={tool.type}
                onClick={() => onToolChange(isActive ? null : tool.type)}
                className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 md:border-b-0 md:border-l-2 ${
                  isActive
                    ? "text-[var(--color-primary,#e60023)] border-[var(--color-primary,#e60023)] bg-[var(--color-primary,#e60023)]/5"
                    : "text-[var(--color-mute,#62625b)] border-transparent hover:bg-[var(--color-surface-soft,#f5f5f5)] hover:text-[var(--color-ink,#1a1a1a)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{tool.label}</span>
              </button>
            );
          })}
        </div>

        {/* 工具面板内容区 */}
        <div className="flex-1 overflow-y-auto hidden md:block">
          {/* 工具内容由父组件通过children传入 */}
        </div>
      </div>
    </>
  );
}