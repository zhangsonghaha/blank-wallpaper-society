"use client";

import type { CategoryItem } from "./types";
import { CATEGORY_COLORS } from "./constants";

export default function CategoryChart({ data }: { data: CategoryItem[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={item.slug} className="group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-[var(--color-body)]">
              {item.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-mute)]">
                {((item.count / total) * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-[var(--color-ash)]">
                {item.count} 张
              </span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--color-surface-card)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无分类数据
        </p>
      )}
    </div>
  );
}
