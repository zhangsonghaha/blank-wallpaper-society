"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { CropArea, FilterValues, TextOverlay, CalendarConfig, FilterConfig, FILTER_PRESETS as FilterPresetsType } from "./types";
import { FILTER_PRESETS } from "./types";

interface EditorCanvasProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  crop: CropArea | null;
  activeFilter: FilterConfig;
  filterValues: FilterValues;
  textOverlays: TextOverlay[];
  calendarConfig: CalendarConfig | null;
  onCropChange?: (crop: CropArea) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
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

export default function EditorCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  crop,
  activeFilter,
  filterValues,
  textOverlays,
  calendarConfig,
  onCropChange,
  onCanvasReady,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [localCrop, setLocalCrop] = useState<CropArea | null>(null);

  // 计算缩放比例
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const containerW = container.clientWidth - 40;
      const containerH = container.clientHeight - 40;
      const scaleX = containerW / imageWidth;
      const scaleY = containerH / imageHeight;
      setScale(Math.min(scaleX, scaleY, 1));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageWidth, imageHeight]);

  // 加载图片
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      renderCanvas();
    };
  }, [imageUrl]);

  // 初始化裁剪区域
  useEffect(() => {
    if (crop) {
      setLocalCrop(crop);
    } else {
      setLocalCrop(null);
    }
  }, [crop]);

  // 生成CSS filter字符串
  const filterCSS = buildFilterCSS(activeFilter, filterValues);

  // 渲染Canvas（用于导出）
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawWidth = imageWidth;
    const drawHeight = imageHeight;
    canvas.width = drawWidth;
    canvas.height = drawHeight;

    // 应用裁剪
    const sourceX = localCrop ? localCrop.x : 0;
    const sourceY = localCrop ? localCrop.y : 0;
    const sourceW = localCrop ? localCrop.width : drawWidth;
    const sourceH = localCrop ? localCrop.height : drawHeight;

    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, drawWidth, drawHeight);

    // 绘制文字覆盖
    for (const overlay of textOverlays) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.font = `${overlay.italic ? "italic " : ""}${overlay.bold ? "bold " : ""}${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      ctx.fillText(overlay.text, overlay.x, overlay.y);
      ctx.restore();
    }

    // 绘制日历
    if (calendarConfig) {
      drawCalendarOnCanvas(ctx, calendarConfig, drawWidth, drawHeight);
    }

    if (onCanvasReady) onCanvasReady(canvas);
  }, [localCrop, textOverlays, calendarConfig, imageWidth, imageHeight, onCanvasReady]);

  // 裁剪框拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!localCrop) return;
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !localCrop || !onCropChange) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (e.clientX - rect.left - dragStart.x) / scale;
    const dy = (e.clientY - rect.top - dragStart.y) / scale;

    const newCrop = {
      ...localCrop,
      x: Math.max(0, Math.min(imageWidth - localCrop.width, localCrop.x + dx)),
      y: Math.max(0, Math.min(imageHeight - localCrop.height, localCrop.y + dy)),
    };
    setLocalCrop(newCrop);
    onCropChange(newCrop);
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center bg-[var(--color-surface-soft,#f5f5f5)] rounded-xl overflow-hidden relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 图片预览 */}
      <div
        className="relative"
        style={{ width: displayWidth, height: displayHeight }}
      >
        <img
          src={imageUrl}
          alt="编辑预览"
          className="w-full h-full object-cover"
          style={{ filter: filterCSS || "none" }}
          crossOrigin="anonymous"
        />

        {/* 文字覆盖预览 */}
        {textOverlays.map((overlay) => (
          <div
            key={overlay.id}
            className="absolute pointer-events-none"
            style={{
              left: overlay.x * scale,
              top: overlay.y * scale,
              fontSize: overlay.fontSize * scale,
              fontFamily: overlay.fontFamily,
              color: overlay.color,
              fontWeight: overlay.bold ? "bold" : "normal",
              fontStyle: overlay.italic ? "italic" : "normal",
              opacity: overlay.opacity,
            }}
          >
            {overlay.text}
          </div>
        ))}

        {/* 日历覆盖预览 */}
        {calendarConfig && (
          <CalendarOverlay
            config={calendarConfig}
            canvasWidth={displayWidth}
            canvasHeight={displayHeight}
            scale={scale}
          />
        )}

        {/* 裁剪框 */}
        {localCrop && (
          <>
            {/* 遮罩层 */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: `inset 0 0 0 9999px rgba(0,0,0,0.5)`,
                clipPath: `inset(${localCrop.y * scale}px ${displayWidth - (localCrop.x + localCrop.width) * scale}px ${displayHeight - (localCrop.y + localCrop.height) * scale}px ${localCrop.x * scale}px)`,
              }}
            />
            {/* 裁剪框边框 */}
            <div
              className="absolute border-2 border-white cursor-move"
              style={{
                left: localCrop.x * scale,
                top: localCrop.y * scale,
                width: localCrop.width * scale,
                height: localCrop.height * scale,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
              }}
              onMouseDown={handleMouseDown}
            >
              {/* 四角手柄 */}
              {[
                { pos: "top-0 left-0", cursor: "nw-resize" },
                { pos: "top-0 right-0", cursor: "ne-resize" },
                { pos: "bottom-0 left-0", cursor: "sw-resize" },
                { pos: "bottom-0 right-0", cursor: "se-resize" },
              ].map((handle, i) => (
                <div
                  key={i}
                  className={`absolute ${handle.pos} w-3 h-3 bg-white border border-gray-400`}
                  style={{ cursor: handle.cursor }}
                />
              ))}
              {/* 网格线（三分法） */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 隐藏Canvas用于导出 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// 日历覆盖组件
function CalendarOverlay({
  config,
  canvasWidth,
  canvasHeight,
  scale,
}: {
  config: CalendarConfig;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}) {
  const daysInMonth = new Date(config.year, config.month, 0).getDate();
  const firstDay = new Date(config.year, config.month - 1, 1).getDay();
  const startOffset = config.startOnMonday ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
  const weekDays = config.startOnMonday
    ? ["一", "二", "三", "四", "五", "六", "日"]
    : ["日", "一", "二", "三", "四", "五", "六"];

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const isRight = config.position === "right";
  const calWidth = isRight ? canvasWidth * 0.3 : canvasWidth * 0.85;
  const calHeight = isRight ? canvasHeight * 0.8 : canvasHeight * 0.35;

  const fontSize = config.style === "minimal" ? 11 : config.style === "modern" ? 13 : 12;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...(isRight
          ? { right: 10, top: "50%", transform: "translateY(-50%)" }
          : { bottom: 10, left: "50%", transform: "translateX(-50%)" }),
        width: calWidth,
        height: calHeight,
        backgroundColor: config.backgroundColor,
        opacity: config.opacity,
        borderRadius: config.style === "modern" ? 12 : 4,
        padding: 8 * scale,
        fontFamily: config.style === "handwrite" ? '"Comic Sans MS", cursive' : config.style === "modern" ? 'Inter, sans-serif' : 'Georgia, serif',
        color: config.textColor,
        fontSize: fontSize * scale,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="text-center font-bold mb-1" style={{ fontSize: (fontSize + 4) * scale }}>
        {config.year}年{config.month}月
      </div>
      <div className="grid grid-cols-7 gap-0 flex-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center font-medium opacity-60" style={{ fontSize: (fontSize - 1) * scale }}>
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div
            key={i}
            className="text-center flex items-center justify-center"
            style={{
              color: day && (i % 7 === (config.startOnMonday ? 5 : 0) || i % 7 === (config.startOnMonday ? 6 : 6)) ? config.accentColor : config.textColor,
            }}
          >
            {day || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// 在Canvas上绘制日历（用于导出）
function drawCalendarOnCanvas(
  ctx: CanvasRenderingContext2D,
  config: CalendarConfig,
  width: number,
  height: number
) {
  const daysInMonth = new Date(config.year, config.month, 0).getDate();
  const firstDay = new Date(config.year, config.month - 1, 1).getDay();
  const startOffset = config.startOnMonday ? (firstDay === 0 ? 6 : firstDay - 1) : firstDay;
  const weekDays = config.startOnMonday
    ? ["一", "二", "三", "四", "五", "六", "日"]
    : ["日", "一", "二", "三", "四", "五", "六"];

  const isRight = config.position === "right";
  const calWidth = isRight ? width * 0.3 : width * 0.85;
  const calHeight = isRight ? height * 0.8 : height * 0.35;
  const calX = isRight ? width - calWidth - 10 : (width - calWidth) / 2;
  const calY = isRight ? (height - calHeight) / 2 : height - calHeight - 10;

  ctx.save();
  ctx.globalAlpha = config.opacity;
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(calX, calY, calWidth, calHeight);

  ctx.fillStyle = config.textColor;
  const baseFontSize = config.style === "minimal" ? 14 : config.style === "modern" ? 18 : 16;
  const font = config.style === "handwrite" ? '"Comic Sans MS", cursive' : config.style === "modern" ? 'Inter, sans-serif' : 'Georgia, serif';

  // 月份标题
  ctx.font = `bold ${baseFontSize + 6}px ${font}`;
  ctx.textAlign = "center";
  ctx.fillText(`${config.year}年${config.month}月`, calX + calWidth / 2, calY + 30);

  // 星期标题
  ctx.font = `${baseFontSize - 2}px ${font}`;
  const cellW = calWidth / 7;
  const startY = calY + 50;
  weekDays.forEach((d, i) => {
    ctx.fillText(d, calX + cellW * i + cellW / 2, startY);
  });

  // 日期
  ctx.font = `${baseFontSize}px ${font}`;
  let row = 1;
  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  days.forEach((day, i) => {
    if (!day) return;
    const col = i % 7;
    if (i > 0 && col === 0) row++;
    const isWeekend = col === (config.startOnMonday ? 5 : 0) || col === (config.startOnMonday ? 6 : 6);
    ctx.fillStyle = isWeekend ? config.accentColor : config.textColor;
    ctx.fillText(String(day), calX + cellW * col + cellW / 2, startY + row * (baseFontSize + 8));
  });

  ctx.restore();
}

export { buildFilterCSS, drawCalendarOnCanvas };