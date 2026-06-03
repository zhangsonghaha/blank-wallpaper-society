"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import type { ImageRecord, PaidImageInfo } from "./types";

export function usePaidWallpaper() {
  const [paidDialogOpen, setPaidDialogOpen] = useState(false);
  const [paidTargetImage, setPaidTargetImage] = useState<ImageRecord | null>(null);
  const [paidPrice, setPaidPrice] = useState("1.99");
  const [paidSaving, setPaidSaving] = useState(false);
  const [paidImagesMap, setPaidImagesMap] = useState<Record<number, PaidImageInfo>>({});

  const loadPaidInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/paid-wallpapers");
      if (res.ok) {
        const data = await res.json();
        const map: Record<number, PaidImageInfo> = {};
        for (const item of data.data || []) {
          map[item.image_id] = { price: parseFloat(item.price), is_paid: !!item.is_paid };
        }
        setPaidImagesMap(map);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadPaidInfo();
  }, [loadPaidInfo]);

  const handleSetPaid = async () => {
    if (!paidTargetImage) return;
    setPaidSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          action: "set_paid_wallpaper",
          imageId: paidTargetImage.id,
          price: parseFloat(paidPrice),
        }),
      });
      if (res.ok) {
        toast.success("付费壁纸设置成功");
        setPaidDialogOpen(false);
        loadPaidInfo();
      } else {
        const data = await res.json();
        toast.error(data.error || "设置失败");
      }
    } catch {
      toast.error("设置失败");
    } finally {
      setPaidSaving(false);
    }
  };

  const handleUnsetPaid = async (imageId: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/earnings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          action: "unset_paid_wallpaper",
          imageId,
        }),
      });
      if (res.ok) {
        toast.success("已取消付费");
        loadPaidInfo();
      } else {
        const data = await res.json();
        toast.error(data.error || "取消失败");
      }
    } catch {
      toast.error("取消失败");
    }
  };

  const handleBatchSetPaid = async (selectedIds: Set<number>) => {
    setPaidSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const imageIds = Array.from(selectedIds);
      let successCount = 0;
      for (const imageId of imageIds) {
        const res = await fetch("/api/earnings", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders },
          body: JSON.stringify({
            action: "set_paid_wallpaper",
            imageId,
            price: parseFloat(paidPrice),
          }),
        });
        if (res.ok) successCount++;
      }
      toast.success(`已设置 ${successCount} 张付费壁纸`);
      setPaidDialogOpen(false);
      loadPaidInfo();
    } catch {
      toast.error("设置失败");
    } finally {
      setPaidSaving(false);
    }
  };

  const openPaidDialog = (image: ImageRecord | null) => {
    setPaidTargetImage(image);
    setPaidPrice("1.99");
    setPaidDialogOpen(true);
  };

  return {
    paidDialogOpen, setPaidDialogOpen,
    paidTargetImage,
    paidPrice, setPaidPrice,
    paidSaving,
    paidImagesMap,
    loadPaidInfo,
    handleSetPaid,
    handleUnsetPaid,
    handleBatchSetPaid,
    openPaidDialog,
  };
}
