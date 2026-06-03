"use client";

import { ASPECT_RATIOS, type CropArea } from "./types";
import { Crop, Check, RotateCcw } from "lucide-react";

interface CropToolProps {
  imageWidth: number;
  imageHeight: number;
  crop: CropArea | null;
  onCropChange: (crop: CropArea | null) => void;
  onApply: () => void;
  onCancel: () => void;
}

export default function CropTool({
  imageWidth,
  imageHeight,
  crop,
  onCropChange,
  onApply,
  onCancel,
}: CropToolProps) {
  const handleAspectRatioSelect = (ratio: number | null) => {
    let newWidth = imageWidth;
    let newHeight = imageHeight;

    if (ratio) {
      // 按比例计算最大裁剪区域
      if (imageWidth / imageHeight > ratio) {
        newWidth = imageHeight * ratio;
        newHeight = imageHeight;
      } else {
        newWidth = imageWidth;
        newHeight = imageWidth / ratio;
      }
    }

    const newCrop: CropArea = {
      x: (imageWidth - newWidth) / 2,
      y: (imageHeight - newHeight) / 2,
      width: newWidth,
      height: newHeight,
      aspectRatio: ratio ?? undefined,
    };

    onCropChange(newCrop);
  };

  const handleReset = () => {
    onCropChange(null);
  };

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink,#1a1a1a)]">
        <Crop className="w-4 h-4" />
        裁剪
      </div>

      {/* 比例选择 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--color-mute,#62625b)]">比例</label>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map((ar) => {
            const isActive = crop?.aspectRatio === ar.value || (!crop?.aspectRatio && ar.value === null);
            return (
              <button
                key={ar.label}
                onClick={() => handleAspectRatioSelect(ar.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-[var(--color-primary,#e60023)] text-white border-[var(--color-primary,#e60023)]"
                    : "bg-[var(--color-surface-card)] text-[var(--color-body,#33332e)] border-[var(--color-hairline,#e5e5e0)] hover:border-[var(--color-primary,#e60023)] hover:text-[var(--color-primary,#e60023)]"
                }`}
              >
                {ar.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 裁剪信息 */}
      {crop && (
        <div className="p-3 bg-[var(--color-surface-soft,#f5f5f5)] rounded-lg text-xs text-[var(--color-mute,#62625b)] space-y-1">
          <div className="flex justify-between">
            <span>裁剪区域</span>
            <span>{Math.round(crop.width)} × {Math.round(crop.height)}</span>
          </div>
          <div className="flex justify-between">
            <span>位置</span>
            <span>({Math.round(crop.x)}, {Math.round(crop.y)})</span>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onApply}
          disabled={!crop}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary,#e60023)] text-white hover:bg-[var(--color-primary-pressed,#cc001f)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          应用裁剪
        </button>
        <button
          onClick={() => {
            handleReset();
            onCancel();
          }}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-surface-card)] border border-[var(--color-hairline,#e5e5e0)] text-[var(--color-body,#33332e)] hover:bg-[var(--color-surface-soft,#f5f5f5)] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}