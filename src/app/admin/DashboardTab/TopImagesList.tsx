"use client";

import { Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TopImage } from "./types";
import { formatNumber } from "./utils";

export default function TopImagesList({ data }: { data: TopImage[] }) {
  return (
    <div className="space-y-2">
      {data.map((img, i) => (
        <div
          key={img.id}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors"
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < 3
                ? "bg-[var(--color-pinterest)] text-white"
                : "bg-[var(--color-surface-card)] text-[var(--color-mute)]"
            }`}
          >
            {i + 1}
          </span>
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
            <img
              src={img.thumbnailUrl}
              alt={img.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{img.title}</p>
            <div className="flex items-center gap-2 text-xs text-[var(--color-ash)]">
              <span>{img.width}×{img.height}</span>
              {img.category && <Badge variant="secondary" className="text-[10px] px-1 py-0">{img.category}</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
              <Download className="w-3.5 h-3.5" />
              {formatNumber(img.downloadCount)}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-ash)]">
              <Eye className="w-3 h-3" />
              {formatNumber(img.viewCount)}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无下载数据
        </p>
      )}
    </div>
  );
}
