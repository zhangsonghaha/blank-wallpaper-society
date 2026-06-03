"use client";

import { HardDrive } from "lucide-react";
import { formatSize } from "./utils";
import type { StorageInfo } from "./types";

export default function StorageOverview({ storage }: { storage: StorageInfo }) {
  const TOTAL_QUOTA = 100 * 1024 * 1024 * 1024; // 100GB
  const usagePercent = Math.min((storage.totalSize / TOTAL_QUOTA) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[var(--color-mute)]" />
          <span className="text-sm font-medium">存储使用</span>
        </div>
        <span className="text-xs text-[var(--color-mute)]">
          {formatSize(storage.totalSize)} / {formatSize(TOTAL_QUOTA)}
        </span>
      </div>
      <div className="h-3 rounded-full bg-[var(--color-surface-card)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${usagePercent}%`,
            backgroundColor:
              usagePercent > 80
                ? "var(--color-error)"
                : "var(--color-pinterest)",
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--color-ash)]">
        <span>共 {storage.fileCount} 个文件</span>
        <span>使用率 {usagePercent.toFixed(1)}%</span>
      </div>
    </div>
  );
}
