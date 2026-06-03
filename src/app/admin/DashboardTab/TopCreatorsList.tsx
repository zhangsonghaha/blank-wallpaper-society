"use client";

import { Download, Eye } from "lucide-react";
import { formatNumber } from "./utils";
import type { TopCreator } from "./types";

export default function TopCreatorsList({ data }: { data: TopCreator[] }) {
  return (
    <div className="space-y-2">
      {data.map((creator, i) => (
        <div
          key={creator.userId}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors"
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < 3
                ? "bg-amber-500 text-white"
                : "bg-[var(--color-surface-card)] text-[var(--color-mute)]"
            }`}
          >
            {i + 1}
          </span>
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
            {creator.avatar ? (
              <img
                src={creator.avatar}
                alt={creator.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-medium text-[var(--color-mute)]">
                {creator.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{creator.name}</p>
            <p className="text-xs text-[var(--color-ash)]">
              {creator.uploadCount} 张作品
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
              <Download className="w-3.5 h-3.5" />
              {formatNumber(creator.totalDownloads)}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-ash)]">
              <Eye className="w-3 h-3" />
              {formatNumber(creator.totalViews)}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无创作者数据
        </p>
      )}
    </div>
  );
}
