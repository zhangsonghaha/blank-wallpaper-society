"use client";

import { useState } from "react";
import { FONT_OPTIONS, type TextOverlay } from "./types";
import { Type, Plus, Trash2 } from "lucide-react";

interface TextToolProps {
  textOverlays: TextOverlay[];
  imageWidth: number;
  imageHeight: number;
  onAddText: (text: TextOverlay) => void;
  onRemoveText: (id: string) => void;
  onUpdateText: (id: string, updates: Partial<TextOverlay>) => void;
}

const WATERMARK_POSITIONS = [
  { label: "左上", x: 0.05, y: 0.08 },
  { label: "右上", x: 0.85, y: 0.08 },
  { label: "左下", x: 0.05, y: 0.95 },
  { label: "右下", x: 0.85, y: 0.95 },
  { label: "居中", x: 0.4, y: 0.5 },
];

export default function TextTool({
  textOverlays,
  imageWidth,
  imageHeight,
  onAddText,
  onRemoveText,
  onUpdateText,
}: TextToolProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedText = textOverlays.find((t) => t.id === selectedId);

  const handleAddText = () => {
    const newText: TextOverlay = {
      id: `text_${Date.now()}`,
      text: "输入文字",
      x: imageWidth * 0.35,
      y: imageHeight * 0.5,
      fontSize: 32,
      fontFamily: FONT_OPTIONS[0].value,
      color: "#ffffff",
      bold: false,
      italic: false,
      opacity: 1,
    };
    onAddText(newText);
    setSelectedId(newText.id);
  };

  const handleQuickPosition = (pos: { x: number; y: number }) => {
    if (!selectedId) return;
    onUpdateText(selectedId, {
      x: imageWidth * pos.x,
      y: imageHeight * pos.y,
    });
  };

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink,#1a1a1a)]">
          <Type className="w-4 h-4" />
          文字/水印
        </div>
        <button
          onClick={handleAddText}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary,#e60023)] text-white hover:bg-[var(--color-primary-pressed,#cc001f)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          添加
        </button>
      </div>

      {/* 文字列表 */}
      {textOverlays.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">文字列表</label>
          <div className="space-y-1.5">
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                onClick={() => setSelectedId(overlay.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                  selectedId === overlay.id
                    ? "border-[var(--color-primary,#e60023)] bg-[var(--color-primary,#e60023)]/5"
                    : "border-[var(--color-hairline,#e5e5e0)] hover:bg-[var(--color-surface-soft,#f5f5f5)]"
                }`}
              >
                <span className="text-sm text-[var(--color-body,#33332e)] truncate flex-1">
                  {overlay.text}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveText(overlay.id);
                    if (selectedId === overlay.id) setSelectedId(null);
                  }}
                  className="ml-2 text-[var(--color-ash,#91918c)] hover:text-[var(--color-error,#9e0a0a)] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 选中文字的编辑面板 */}
      {selectedText && (
        <div className="space-y-4">
          {/* 文字内容 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">内容</label>
            <input
              type="text"
              value={selectedText.text}
              onChange={(e) => onUpdateText(selectedText.id, { text: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-hairline,#e5e5e0)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#e60023)] focus:border-transparent"
              placeholder="输入文字内容"
            />
          </div>

          {/* 字体和大小 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">字体</label>
              <select
                value={selectedText.fontFamily}
                onChange={(e) => onUpdateText(selectedText.id, { fontFamily: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-hairline,#e5e5e0)] text-xs bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#e60023)]"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">大小</label>
              <input
                type="number"
                value={selectedText.fontSize}
                onChange={(e) => onUpdateText(selectedText.id, { fontSize: parseInt(e.target.value) || 16 })}
                min={8}
                max={200}
                className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-hairline,#e5e5e0)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary,#e60023)]"
              />
            </div>
          </div>

          {/* 颜色 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">颜色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selectedText.color}
                onChange={(e) => onUpdateText(selectedText.id, { color: e.target.value })}
                className="w-8 h-8 rounded-md border border-[var(--color-hairline,#e5e5e0)] cursor-pointer"
              />
              <div className="flex gap-1.5">
                {["#ffffff", "#000000", "#e60023", "#ff9800", "#4caf50", "#2196f3"].map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdateText(selectedText.id, { color: c })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedText.color === c ? "border-[var(--color-primary,#e60023)] scale-110" : "border-[var(--color-hairline,#e5e5e0)]"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 样式按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateText(selectedText.id, { bold: !selectedText.bold })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                selectedText.bold
                  ? "bg-[var(--color-primary,#e60023)] text-white border-[var(--color-primary,#e60023)]"
                  : "bg-[var(--color-surface-card)] text-[var(--color-body,#33332e)] border-[var(--color-hairline,#e5e5e0)]"
              }`}
            >
              B
            </button>
            <button
              onClick={() => onUpdateText(selectedText.id, { italic: !selectedText.italic })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium italic transition-colors border ${
                selectedText.italic
                  ? "bg-[var(--color-primary,#e60023)] text-white border-[var(--color-primary,#e60023)]"
                  : "bg-[var(--color-surface-card)] text-[var(--color-body,#33332e)] border-[var(--color-hairline,#e5e5e0)]"
              }`}
            >
              I
            </button>
          </div>

          {/* 透明度 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-mute,#62625b)]">透明度</span>
              <span className="text-[var(--color-mute,#62625b)] tabular-nums">
                {Math.round(selectedText.opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedText.opacity}
              onChange={(e) => onUpdateText(selectedText.id, { opacity: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-[var(--color-hairline,#e5e5e0)] cursor-pointer accent-[var(--color-primary,#e60023)]"
            />
          </div>

          {/* 水印位置快捷 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">快捷位置</label>
            <div className="grid grid-cols-5 gap-1.5">
              {WATERMARK_POSITIONS.map((pos) => (
                <button
                  key={pos.label}
                  onClick={() => handleQuickPosition(pos)}
                  className="px-2 py-1.5 rounded-md text-[10px] font-medium bg-[var(--color-surface-card)] border border-[var(--color-hairline,#e5e5e0)] text-[var(--color-body,#33332e)] hover:border-[var(--color-primary,#e60023)] hover:text-[var(--color-primary,#e60023)] transition-colors"
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}