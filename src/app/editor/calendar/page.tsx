"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import EditorCanvas from "@/components/Editor/Canvas";
import CalendarTool from "@/components/Editor/CalendarTool";
import { FILTER_PRESETS, type CalendarConfig } from "@/components/Editor/types";
import { buildFilterCSS, drawCalendarOnCanvas } from "@/components/Editor/Canvas";
import { ArrowLeft, Download } from "lucide-react";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function CalendarEditorPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarEditorContent />
    </Suspense>
  );
}

function CalendarLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-2 border-[var(--color-primary,#e60023)] border-t-transparent rounded-full" />
    </div>
  );
}

function CalendarEditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const imageUrl = searchParams.get("src") || "";
  const imageWidth = parseInt(searchParams.get("width") || "1920");
  const imageHeight = parseInt(searchParams.get("height") || "1080");

  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
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
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 加载原图
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
        img.src = imageUrl;
      });

      // 创建Canvas
      const canvas = document.createElement("canvas");
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas初始化失败");

      // 绘制原图
      ctx.drawImage(img, 0, 0);

      // 绘制日历
      drawCalendarOnCanvas(ctx, calendarConfig, imageWidth, imageHeight);

      // 导出
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            toast.error("导出失败");
            setIsExporting(false);
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `calendar_${calendarConfig.year}${String(calendarConfig.month).padStart(2, "0")}_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("日历壁纸导出成功");
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

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (!imageUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-soft,#f5f5f5)]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-hairline,#e5e5e0)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--color-ash,#91918c)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-[var(--color-ink,#1a1a1a)]">请选择一张底图</h2>
          <p className="text-sm text-[var(--color-mute,#62625b)]">从图片详情页点击"日历壁纸"按钮进入</p>
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

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* 顶部操作栏 */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-[var(--color-hairline,#e5e5e0)] bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm text-[var(--color-mute,#62625b)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">返回</span>
          </button>
          <div className="h-5 w-px bg-[var(--color-hairline,#e5e5e0)]" />
          <h1 className="text-sm font-medium text-[var(--color-ink,#1a1a1a)]">日历壁纸生成器</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-mute,#62625b)] hidden sm:inline">
            {calendarConfig.year}年{calendarConfig.month}月 · {calendarConfig.style === "minimal" ? "简约" : calendarConfig.style === "modern" ? "现代" : "手写"}风格
          </span>
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
            {isExporting ? "生成中..." : "下载壁纸"}
          </button>
        </div>
      </div>

      {/* 主体区域 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 画布预览区 */}
        <div className="flex-1 overflow-hidden">
          <EditorCanvas
            imageUrl={imageUrl}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            crop={null}
            activeFilter={FILTER_PRESETS[0]}
            filterValues={{}}
            textOverlays={[]}
            calendarConfig={calendarConfig}
          />
        </div>

        {/* 右侧日历配置面板 */}
        <div className="w-80 shrink-0 border-l border-[var(--color-hairline,#e5e5e0)] bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-hairline,#e5e5e0)]">
            <h2 className="text-sm font-medium text-[var(--color-ink,#1a1a1a)]">日历配置</h2>
            <p className="text-xs text-[var(--color-mute,#62625b)] mt-0.5">自定义你的日历壁纸</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CalendarTool
              calendarConfig={calendarConfig}
              onConfigChange={(config) => config && setCalendarConfig(config)}
            />
          </div>

          {/* 底部快捷月份选择 */}
          <div className="p-4 border-t border-[var(--color-hairline,#e5e5e0)]">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)] mb-2 block">快速选择月份</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <button
                  key={m}
                  onClick={() => setCalendarConfig({ ...calendarConfig, month: m })}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                    calendarConfig.month === m
                      ? "bg-[var(--color-primary,#e60023)] text-white"
                      : "bg-[var(--color-surface-soft,#f5f5f5)] text-[var(--color-body,#33332e)] hover:bg-[var(--color-secondary-bg,#e5e5e0)]"
                  }`}
                >
                  {m}月
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 移动端底部面板 */}
      <div className="md:hidden shrink-0 border-t border-[var(--color-hairline,#e5e5e0)] bg-white max-h-[50vh] overflow-y-auto">
        <CalendarTool
          calendarConfig={calendarConfig}
          onConfigChange={(config) => config && setCalendarConfig(config)}
        />
      </div>
    </div>
  );
}