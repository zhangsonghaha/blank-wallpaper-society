"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ImageRecord, PaidImageInfo } from "./types";

interface PaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paidTargetImage: ImageRecord | null;
  paidPrice: string;
  setPaidPrice: (price: string) => void;
  paidSaving: boolean;
  paidImagesMap: Record<number, PaidImageInfo>;
  selectedIds: Set<number>;
  onConfirm: () => void;
  onBatchConfirm: (selectedIds: Set<number>) => void;
}

export default function PaidDialog({
  open,
  onOpenChange,
  paidTargetImage,
  paidPrice,
  setPaidPrice,
  paidSaving,
  paidImagesMap,
  selectedIds,
  onConfirm,
  onBatchConfirm,
}: PaidDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置付费壁纸</DialogTitle>
          <DialogDescription>
            {paidTargetImage
              ? `设置「${paidTargetImage.title}」为付费壁纸`
              : `批量设置 ${selectedIds.size} 张图片为付费壁纸`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>价格 (元)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.99"
              max="9.99"
              value={paidPrice}
              onChange={(e) => setPaidPrice(e.target.value)}
              placeholder="0.99 - 9.99"
            />
            <p className="text-xs text-[var(--color-mute)]">
              价格范围：¥0.99 - ¥9.99，平台抽成15%
            </p>
          </div>
          {paidTargetImage && paidImagesMap[paidTargetImage.id]?.is_paid && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                当前价格：¥{paidImagesMap[paidTargetImage.id].price.toFixed(2)}，修改将覆盖
              </p>
            </div>
          )}
          {/* 预览 */}
          {paidTargetImage && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-surface-soft)]">
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <img src={paidTargetImage.thumbnail_url || paidTargetImage.url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{paidTargetImage.title}</p>
                <p className="text-xs text-[var(--color-mute)]">{paidTargetImage.width}×{paidTargetImage.height}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            onClick={() => {
              if (paidTargetImage) {
                onConfirm();
              } else {
                onBatchConfirm(selectedIds);
              }
            }}
            disabled={paidSaving || !paidPrice || parseFloat(paidPrice) < 0.99 || parseFloat(paidPrice) > 9.99}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {paidSaving ? "保存中..." : `确认设置 ¥${parseFloat(paidPrice || "0").toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
