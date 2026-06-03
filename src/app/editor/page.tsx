"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import EditorCanvas from "@/components/Editor/Canvas";
import CropTool from "@/components/Editor/CropTool";
import FilterTool from "@/components/Editor/FilterTool";
import TextTool from "@/components/Editor/TextTool";
import CalendarTool from "@/components/Editor/CalendarTool";
import {
  FILTER_PRESETS,
  DEFAULT_FILTER_VALUES,
  type CropArea,
  type FilterConfig,
  type FilterValues,
  type TextOverlay,
  type CalendarConfig,
  type ToolType,
  type EditorHistoryEntry,
} from "@/components/Editor/types";
import { buildFilterCSS, drawCalendarOnCanvas } from "@/components/Editor/Canvas";
import { Crop, Sparkles, Type, Calendar, Undo2, Redo2, Download, ArrowLeft } from "lucide-react";

const TOOLS: { type: ToolType; icon: typeof Crop; label: string }[] = [
  { type: "crop", icon: Crop, label: "裁剪" },
  { type: "filter", icon: Sparkles, label: "滤镜" },
  { type: "text", icon: Type, label: "文字" },
  { type: "calendar", icon: Calendar, label: "日历" },
];

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorLoading />}>
      <EditorContent />
    </Suspense>
  );
}

function EditorLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-surface-soft)]">
      <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary,#e60023)] border-t-transparent rounded-full" />
    </div>
  );
}

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawImageUrl = searchParams.get("src") || "";
  const imageWidth = parseInt(searchParams.get("width") || "1920");
  const imageHeight = parseInt(searchParams.get("height") || "1080");
  const imageId = searchParams.get("id") || "";

  // 使用代理 URL 避免 CORS 问题
  const imageUrl = rawImageUrl
    ? `/api/proxy-image?url=${encodeURIComponent(rawImageUrl)}`
    : "";

  // 编辑器状态
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterConfig>(FILTER_PRESETS[0]);
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 历史记录
  const [history, setHistory] = useState<EditorHistoryEntry[]>([
    { crop: null, filterValues: {}, textOverlays: [], calendarConfig: null },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 添加历史记录
  const pushHistory = useCallback(() => {
    const entry: EditorHistoryEntry = {
      crop,
      filterValues: { ...filterValues },
      textOverlays: [...textOverlays],
      calendarConfig: calendarConfig ? { ...calendarConfig } : null,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [crop, filterValues, textOverlays, calendarConfig, history, historyIndex]);

  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const entry = history[newIndex];
    setCrop(entry.crop);
    setFilterValues(entry.filterValues);
    setTextOverlays(entry.textOverlays);
    setCalendarConfig(entry.calendarConfig);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const entry = history[newIndex];
    setCrop(entry.crop);
    setFilterValues(entry.filterValues);
    setTextOverlays(entry.textOverlays);
    setCalendarConfig(entry.calendarConfig);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // 裁剪操作
  const handleCropApply = () => {
    pushHistory();
    toast.success("裁剪已应用");
    setActiveTool(null);
  };

  const handleCropCancel = () => {
    setCrop(null);
    setActiveTool(null);
  };

  // 滤镜操作
  const handleFilterChange = (filter: FilterConfig) => {
    setActiveFilter(filter);
    if (filter.name === "original") {
      setFilterValues({});
    } else {
      const defaults: FilterValues = {};
      for (const param of filter.params) {
        defaults[param.key] = param.default;
      }
      setFilterValues(defaults);
    }
    pushHistory();
  };

  const handleFilterValuesChange = (values: FilterValues) => {
    setFilterValues(values);
  };

  const handleFilterReset = () => {
    setActiveFilter(FILTER_PRESETS[0]);
    setFilterValues({});
    pushHistory();
  };

  // 文字操作
  const handleAddText = (text: TextOverlay) => {
    setTextOverlays((prev) => [...prev, text]);
    pushHistory();
  };

  const handleRemoveText = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    pushHistory();
  };

  const handleUpdateText = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  // 日历操作
  const handleCalendarChange = (config: CalendarConfig | null) => {
    setCalendarConfig(config);
    pushHistory();
  };

  // 导出 - 使用前端Canvas直接导出（支持文字/日历叠加）
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 加载原图到Image
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = imageUrl;
      });

      // 计算输出尺寸
      const outW = crop ? Math.round(crop.width) : imageWidth;
      const outH = crop ? Math.round(crop.height) : imageHeight;

      // 创建Canvas
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas初始化失败");

      // 应用CSS滤镜
      const filterCSS = buildFilterCSS(activeFilter, filterValues);
      if (filterCSS && filterCSS !== "none") {
        ctx.filter = filterCSS;
      }

      // 绘制图片（应用裁剪）
      const sx = crop ? crop.x : 0;
      const sy = crop ? crop.y : 0;
      const sw = crop ? crop.width : imageWidth;
      const sh = crop ? crop.height : imageHeight;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      // 重置滤镜
      ctx.filter = "none";

      // 绘制文字覆盖
      for (const overlay of textOverlays) {
        ctx.save();
        ctx.globalAlpha = overlay.opacity;
        ctx.font = `${overlay.italic ? "italic " : ""}${overlay.bold ? "bold " : ""}${overlay.fontSize}px ${overlay.fontFamily}`;
        ctx.fillStyle = overlay.color;
        const textX = crop ? overlay.x - crop.x : overlay.x;
        const textY = crop ? overlay.y - crop.y : overlay.y;
        ctx.fillText(overlay.text, textX, textY);
        ctx.restore();
      }

      // 绘制日历
      if (calendarConfig) {
        drawCalendarOnCanvas(ctx, calendarConfig, outW, outH);
      }

      // 导出为PNG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("导出失败", { description: "图片生成失败" });
            setIsExporting(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `edited_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("导出成功");
          setIsExporting(false);
        },
        "image/png",
        1.0
      );
    } catch (err) {
      toast.error("导出失败", { description: err instanceof Error ? err.message : "请重试" });
      setIsExporting(false);
    }
  };

  // 返回
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  // 无图片时显示提示
  if (!imageUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-soft,#f5f5f5)]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-hairline,#e5e5e0)] flex items-center justify-center">
            <Crop className="w-8 h-8 text-[var(--color-ash,#91918c)]" />
          </div>
          <h2 className="text-lg font-medium text-[var(--color-ink,#1a1a1a)]">请选择一张图片进行编辑</h2>
          <p className="text-sm text-[var(--color-mute,#62625b)]">从图片详情页点击"编辑"按钮进入</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary,#e60023)] text-white hover:bg-[var(--color-primary-pressed,#cc001f)] transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="h-screen flex flex-col bg-[var(--color-surface-soft)] overflow-hidden">
      {/* 顶部操作栏 */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[var(--color-hairline,#e5e5e0)] bg-[var(--color-surface-card)]">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="p-2 rounded-lg text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleExport}
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

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 画布预览区 */}
        <div className="flex-1 overflow-hidden">
          <EditorCanvas
            imageUrl={imageUrl}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            crop={crop}
            activeFilter={activeFilter}
            filterValues={filterValues}
            textOverlays={textOverlays}
            calendarConfig={calendarConfig}
            onCropChange={setCrop}
          />
        </div>

        {/* 右侧工具面板 */}
        <div className="w-72 shrink-0 border-l border-[var(--color-hairline,#e5e5e0)] bg-[var(--color-surface-card)] flex flex-col overflow-hidden hidden md:flex">
          {/* 工具选择标签 */}
          <div className="flex border-b border-[var(--color-hairline,#e5e5e0)]">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.type;
              return (
                <button
                  key={tool.type}
                  onClick={() => setActiveTool(isActive ? null : tool.type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2 ${
                    isActive
                      ? "text-[var(--color-primary,#e60023)] border-[var(--color-primary,#e60023)] bg-[var(--color-primary,#e60023)]/5"
                      : "text-[var(--color-mute,#62625b)] border-transparent hover:bg-[var(--color-surface-soft,#f5f5f5)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tool.label}
                </button>
              );
            })}
          </div>

          {/* 工具面板内容 */}
          <div className="flex-1 overflow-y-auto">
            {activeTool === "crop" && (
              <CropTool
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                crop={crop}
                onCropChange={setCrop}
                onApply={handleCropApply}
                onCancel={handleCropCancel}
              />
            )}
            {activeTool === "filter" && (
              <FilterTool
                activeFilter={activeFilter}
                filterValues={filterValues}
                imageUrl={imageUrl}
                onFilterChange={handleFilterChange}
                onFilterValuesChange={handleFilterValuesChange}
                onReset={handleFilterReset}
              />
            )}
            {activeTool === "text" && (
              <TextTool
                textOverlays={textOverlays}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                onAddText={handleAddText}
                onRemoveText={handleRemoveText}
                onUpdateText={handleUpdateText}
              />
            )}
            {activeTool === "calendar" && (
              <CalendarTool
                calendarConfig={calendarConfig}
                onConfigChange={handleCalendarChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* 移动端底部工具栏 */}
      <div className="md:hidden shrink-0 border-t border-[var(--color-hairline,#e5e5e0)] bg-[var(--color-surface-card)]">
        <div className="flex">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.type;
            return (
              <button
                key={tool.type}
                onClick={() => setActiveTool(isActive ? null : tool.type)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                  isActive
                    ? "text-[var(--color-primary,#e60023)]"
                    : "text-[var(--color-mute,#62625b)]"
                }`}
              >
                <Icon className="w-5 h-5" />
                {tool.label}
              </button>
            );
          })}
        </div>

        {/* 移动端工具面板（弹出式） */}
        {activeTool && (
          <div className="border-t border-[var(--color-hairline,#e5e5e0)] max-h-[50vh] overflow-y-auto">
            {activeTool === "crop" && (
              <CropTool
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                crop={crop}
                onCropChange={setCrop}
                onApply={handleCropApply}
                onCancel={handleCropCancel}
              />
            )}
            {activeTool === "filter" && (
              <FilterTool
                activeFilter={activeFilter}
                filterValues={filterValues}
                imageUrl={imageUrl}
                onFilterChange={handleFilterChange}
                onFilterValuesChange={handleFilterValuesChange}
                onReset={handleFilterReset}
              />
            )}
            {activeTool === "text" && (
              <TextTool
                textOverlays={textOverlays}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                onAddText={handleAddText}
                onRemoveText={handleRemoveText}
                onUpdateText={handleUpdateText}
              />
            )}
            {activeTool === "calendar" && (
              <CalendarTool
                calendarConfig={calendarConfig}
                onConfigChange={handleCalendarChange}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}