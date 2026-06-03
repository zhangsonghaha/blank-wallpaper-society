"use client";

import { Copy, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

interface DuplicatesPanelProps {
  duplicateLoading: boolean;
  duplicateGroups: any[];
  duplicateDeleteIds: Set<number>;
  duplicateDeleting: boolean;
  onToggleDuplicateSelect: (id: number) => void;
  onSetDuplicateDeleteIds: (ids: Set<number>) => void;
  onHandleDuplicateDelete: () => void;
}

export default function DuplicatesPanel({
  duplicateLoading,
  duplicateGroups,
  duplicateDeleteIds,
  duplicateDeleting,
  onToggleDuplicateSelect,
  onSetDuplicateDeleteIds,
  onHandleDuplicateDelete,
}: DuplicatesPanelProps) {
  if (duplicateLoading) {
    return (
      <div className="space-y-3 py-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (duplicateGroups.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
          <Copy className="w-8 h-8 text-[var(--color-ash)]" />
        </div>
        <h3 className="text-lg font-semibold mb-1">未发现重复图片</h3>
        <p className="text-sm text-[var(--color-mute)]">
          所有图片都是唯一的，没有检测到相似图片
        </p>
      </div>
    );
  }

  return (
    <>
      {duplicateDeleteIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-orange-50 rounded-xl border border-orange-200">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-700">
            已选择 {duplicateDeleteIds.size} 张待删除
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7"
            onClick={() => onSetDuplicateDeleteIds(new Set())}
          >
            取消选择
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-full text-xs h-7 gap-1"
            disabled={duplicateDeleting}
            onClick={onHandleDuplicateDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {duplicateDeleting ? "删除中..." : "删除选中"}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {duplicateGroups.map((group, gi) => (
          <div
            key={gi}
            className="border rounded-xl p-4 bg-[var(--color-surface-soft)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  第 {gi + 1} 组
                </Badge>
                <span className="text-xs text-[var(--color-mute)]">
                  {group.images.length} 张相似图片
                </span>
              </div>
              <Badge variant="outline" className="rounded-full text-xs">
                相似度 {group.similarity}%
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {group.images.map((img: any) => (
                <div
                  key={img.id}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                    duplicateDeleteIds.has(img.id)
                      ? "border-red-400 ring-2 ring-red-200"
                      : "border-transparent hover:border-[var(--color-primary)]"
                  }`}
                  onClick={() => onToggleDuplicateSelect(img.id)}
                >
                  <div className="aspect-square bg-[var(--color-surface-card)]">
                    <img
                      src={img.thumbnail_url || img.url}
                      alt={img.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-1 left-1">
                    <Checkbox
                      checked={duplicateDeleteIds.has(img.id)}
                      onCheckedChange={() => onToggleDuplicateSelect(img.id)}
                    />
                  </div>
                  <div className="p-1.5 bg-background/80">
                    <p className="text-xs truncate">{img.title}</p>
                    <p className="text-[10px] text-[var(--color-mute)]">
                      ID: {img.id}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
