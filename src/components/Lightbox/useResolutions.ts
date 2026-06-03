"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import { toast } from "sonner";
import type { GalleryImage } from "@/data/images";
import { RESOLUTIONS, CATEGORY_LABELS, type Resolution } from "@/lib/resolutions";
import { withCsrfHeader } from "@/lib/csrf-client";
import { Smartphone, Monitor, Tablet } from "lucide-react";
import type { ResolutionWithCache } from "./types";

export const CATEGORY_ICONS = {
  phone: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
} as const;

export function useResolutions(
  currentImage: GalleryImage | undefined,
  isPaidWallpaper: boolean,
  hasPurchased: boolean,
  onPaymentNeeded: () => void,
) {
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false);
  const [resolutions, setResolutions] = useState<ResolutionWithCache[]>([]);
  const [downloadingRes, setDownloadingRes] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadingResolutions, setLoadingResolutions] = useState(false);

  const downloadBtnRef = useRef<HTMLButtonElement>(null);
  const downloadPanelRef = useRef<HTMLDivElement>(null);
  const [downloadPanelPos, setDownloadPanelPos] = useState<{ top: number; left: number } | null>(null);

  // 推荐分辨率
  const recommendedResolution = useMemo(() => {
    if (typeof window === "undefined") return null;
    const w = window.screen.width;
    const h = window.screen.height;
    let best: Resolution | null = null;
    let bestDiff = Infinity;
    for (const res of RESOLUTIONS) {
      const diff = Math.abs(res.width * res.height - w * h);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = res;
      }
    }
    return best;
  }, []);

  // 分辨率按类别分组
  const groupedResolutions = useMemo(() => {
    const groups: Record<string, ResolutionWithCache[]> = {
      phone: [],
      desktop: [],
      tablet: [],
    };
    for (const res of resolutions) {
      groups[res.category].push(res);
    }
    return groups;
  }, [resolutions]);

  // 动态修正面板水平位置
  useLayoutEffect(() => {
    if (downloadPanelOpen && downloadPanelRef.current && downloadBtnRef.current) {
      const panelRect = downloadPanelRef.current.getBoundingClientRect();
      const btnRect = downloadBtnRef.current.getBoundingClientRect();
      const halfPanelW = panelRect.width / 2;
      const halfBtnW = btnRect.width / 2;
      let left = btnRect.left + halfBtnW;
      if (left - halfPanelW < 8) left = halfPanelW + 8;
      if (left + halfPanelW > window.innerWidth - 8) left = window.innerWidth - halfPanelW - 8;
      setDownloadPanelPos({ top: btnRect.top - 8, left });
    }
  }, [downloadPanelOpen]);

  // 获取分辨率列表
  const fetchResolutions = useCallback(async () => {
    if (!currentImage) return;
    setLoadingResolutions(true);
    try {
      const res = await fetch(`/api/images/${currentImage.id}/resize`);
      if (res.ok) {
        const data = await res.json();
        setResolutions(data.resolutions || []);
      }
    } catch {
      setResolutions(RESOLUTIONS);
    }
    setLoadingResolutions(false);
  }, [currentImage]);

  // 打开下载面板时获取分辨率
  useEffect(() => {
    if (downloadPanelOpen && currentImage) {
      fetchResolutions();
    }
  }, [downloadPanelOpen, currentImage, fetchResolutions]);

  // 图片切换时重置下载状态
  const prevImageId = useRef<number | null>(null);
  useEffect(() => {
    const id = currentImage?.id ?? null;
    if (id !== prevImageId.current) {
      prevImageId.current = id;
      setDownloadPanelOpen(false);
      setDownloadPanelPos(null);
      setDownloadingRes(null);
      setDownloadProgress(0);
    }
  }, [currentImage?.id]);

  const triggerDownload = (blob: Blob, resolution?: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = resolution ? `_${resolution}` : "";
    const isVideo = currentImage?.media_type === "video";
    const ext = isVideo ? "mp4" : "webp";
    a.download = `${currentImage?.title || "image"}${suffix}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 下载指定分辨率
  const handleDownloadResolution = async (resolution?: string) => {
    if (!currentImage || downloadingRes) return;

    if (isPaidWallpaper && !hasPurchased) {
      onPaymentNeeded();
      return;
    }

    const resKey = resolution || "original";
    setDownloadingRes(resKey);
    setDownloadProgress(0);

    try {
      const url = resolution
        ? `/api/images/${currentImage.id}/download?resolution=${resolution}`
        : `/api/images/${currentImage.id}/download`;

      const response = await fetch(url);

      if (response.status === 402) {
        const data = await response.json();
        onPaymentNeeded();
        return;
      }

      if (!response.ok) {
        throw new Error("下载失败");
      }

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength) : 0;

      if (total && typeof ReadableStream !== "undefined") {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");

        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            setDownloadProgress(Math.round((received / total) * 100));
          }
        }

        const defaultType = currentImage?.media_type === "video" ? "video/mp4" : "image/webp";
        const blob = new Blob(chunks.map(c => new Uint8Array(c)), {
          type: response.headers.get("Content-Type") || defaultType,
        });
        triggerDownload(blob, resolution);
      } else {
        const blob = await response.blob();
        triggerDownload(blob, resolution);
      }

      toast.success(resolution ? `已下载 ${resolution}` : "原图下载完成");
      setDownloadPanelOpen(false);

      // 记录下载日志
      withCsrfHeader().then((csrfHeaders) => {
        fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders },
          body: JSON.stringify({
            type: "download",
            image_id: currentImage.id,
            resolution: resolution || "original",
          }),
        }).catch(() => {});
      });
    } catch {
      toast.error("下载失败，请重试");
    } finally {
      setDownloadingRes(null);
      setDownloadProgress(0);
    }
  };

  // 图片切换时重置下载状态
  const resetDownloadState = () => {
    setDownloadPanelOpen(false);
    setDownloadPanelPos(null);
    setDownloadingRes(null);
    setDownloadProgress(0);
  };

  return {
    downloadPanelOpen,
    setDownloadPanelOpen,
    resolutions,
    downloadingRes,
    downloadProgress,
    loadingResolutions,
    groupedResolutions,
    recommendedResolution,
    downloadBtnRef,
    downloadPanelRef,
    downloadPanelPos,
    setDownloadPanelPos,
    handleDownloadResolution,
    resetDownloadState,
    CATEGORY_LABELS,
    CATEGORY_ICONS,
  };
}
