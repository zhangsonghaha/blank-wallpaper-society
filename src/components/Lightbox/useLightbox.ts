"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { GalleryImage } from "@/data/images";
import { withCsrfHeader } from "@/lib/csrf-client";
import type { LightboxProps } from "./types";
import { REPORT_CATEGORIES } from "./types";

export function useLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onPrev,
  onNext,
  favoritedIds,
  onToggleFavorite,
  onJumpToImage,
}: LightboxProps) {
  // 额外追加的相似图片
  const [extraImages, setExtraImages] = useState<GalleryImage[]>([]);
  const allImages = useMemo(() => [...images, ...extraImages], [images, extraImages]);
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  const activeIndex = overrideIndex !== null ? overrideIndex : currentIndex;

  // 当 lightbox 关闭时清空额外图片
  useEffect(() => {
    if (!isOpen) {
      setExtraImages([]);
      setOverrideIndex(null);
    }
  }, [isOpen]);

  const currentImage = allImages[activeIndex];
  const [isLoaded, setIsLoaded] = useState(false);

  // 举报状态
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportCategory, setReportCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 分享状态
  const [shareOpen, setShareOpen] = useState(false);

  // 关注状态
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loadingFollowStatus, setLoadingFollowStatus] = useState(false);

  // 面板开关
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [exifOpen, setExifOpen] = useState(false);

  // 设备预览
  const [devicePreview, setDevicePreview] = useState(false);

  // 付费壁纸
  const [isPaidWallpaper, setIsPaidWallpaper] = useState(false);
  const [paidPrice, setPaidPrice] = useState(0);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // 下载成功引导
  const [downloadSuccessOpen, setDownloadSuccessOpen] = useState(false);

  const isFavorited = favoritedIds?.has(currentImage?.id) ?? false;

  // 记录浏览日志
  const trackView = useCallback(async (imageId: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ type: "view", image_id: imageId }),
      });
    } catch {
      // 静默失败
    }
  }, []);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        if (reportOpen) { setReportOpen(false); return; }
        if (addToCollectionOpen) { setAddToCollectionOpen(false); return; }
        if (commentOpen) { setCommentOpen(false); return; }
        if (similarOpen) { setSimilarOpen(false); return; }
        if (exifOpen) { setExifOpen(false); return; }
        if (devicePreview) { setDevicePreview(false); return; }
        onClose();
        return;
      }

      if (reportOpen || addToCollectionOpen || commentOpen || similarOpen || exifOpen || devicePreview) return;

      switch (e.key) {
        case "ArrowLeft":
          if (!devicePreview) onPrev();
          break;
        case "ArrowRight":
          if (!devicePreview) onNext();
          break;
      }
    },
    [isOpen, onClose, onPrev, onNext, reportOpen, addToCollectionOpen, commentOpen, similarOpen, exifOpen, devicePreview]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setIsLoaded(false);
      if (currentImage?.id) {
        trackView(currentImage.id);
      }
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // 重置状态当图片切换
  const resetImageState = () => {
    setIsLoaded(false);
    setDevicePreview(false);
    setReportOpen(false);
    setAddToCollectionOpen(false);
    setCommentOpen(false);
    setSimilarOpen(false);
    setExifOpen(false);
    setIsPaidWallpaper(false);
    setPaidPrice(0);
    setHasPurchased(false);
    setPaymentDialogOpen(false);
    setDownloadSuccessOpen(false);
  };

  useEffect(() => {
    resetImageState();

    // 检查是否为付费壁纸
    if (currentImage?.id) {
      fetch(`/api/images/${currentImage.id}/paid-status`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.is_paid_wallpaper) {
            setIsPaidWallpaper(true);
            setPaidPrice(data.price);
            setHasPurchased(data.has_purchased || false);
          }
        })
        .catch(() => {});
    }
  }, [activeIndex]);

  // 获取作者关注状态
  useEffect(() => {
    if (!currentImage?.uploaded_by) return;

    setLoadingFollowStatus(true);
    fetch(`/api/users/${currentImage.uploaded_by}/follow`)
      .then((res) => res.json())
      .then((data) => {
        setIsFollowing(data.isFollowing || false);
        setFollowersCount(data.followers || 0);
        setLoadingFollowStatus(false);
      })
      .catch(() => setLoadingFollowStatus(false));
  }, [currentImage?.uploaded_by]);

  // 收藏
  const handleFavorite = () => {
    if (onToggleFavorite && currentImage) {
      onToggleFavorite(currentImage.id);
    }
  };

  // 举报
  const handleReport = async () => {
    if (!currentImage) return;
    if (!reportCategory) {
      toast.error("请选择举报分类");
      return;
    }
    if (!reportReason.trim() && reportCategory !== "other") {
      toast.error("请填写举报原因");
      return;
    }
    setSubmitting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          imageId: currentImage.id,
          reason: `[${REPORT_CATEGORIES.find(c => c.value === reportCategory)?.label || reportCategory}] ${reportReason.trim()}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("举报成功", { description: "我们会尽快处理" });
        setReportOpen(false);
        setReportReason("");
        setReportCategory("");
      } else {
        toast.error("举报失败", { description: data.error });
      }
    } catch {
      toast.error("举报失败", { description: "网络错误" });
    }
    setSubmitting(false);
  };

  // 关注/取关
  const handleToggleFollow = async () => {
    if (!currentImage?.uploaded_by) return;

    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    setFollowersCount(prev => newFollowing ? prev + 1 : prev - 1);

    try {
      const method = newFollowing ? "POST" : "DELETE";
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/users/${currentImage.uploaded_by}/follow`, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
      });

      if (!res.ok) {
        setIsFollowing(!newFollowing);
        setFollowersCount(prev => newFollowing ? prev - 1 : prev + 1);
        toast.error("操作失败，请重试");
      } else {
        const data = await res.json();
        setFollowersCount(data.followers || (newFollowing ? followersCount + 1 : followersCount - 1));
        toast.success(newFollowing ? "已关注" : "已取消关注");
      }
    } catch {
      setIsFollowing(!newFollowing);
      setFollowersCount(prev => newFollowing ? prev - 1 : prev + 1);
      toast.error("网络错误，请重试");
    }
  };

  // 处理相似图片点击
  const handleSimilarImageClick = (img: any) => {
    const idx = allImages.findIndex((i) => i.id === img.id);
    if (idx >= 0) {
      setSimilarOpen(false);
      setOverrideIndex(idx);
      setIsLoaded(false);
      onJumpToImage?.(img.id);
    } else {
      const newImg: GalleryImage = {
        id: img.id,
        src: img.display_url || img.url || img.thumbnail_url || "",
        width: img.width || 1920,
        height: img.height || 1080,
        title: img.title || "",
        description: img.description || "",
        tags: img.tags ? (Array.isArray(img.tags) ? img.tags : img.tags.split(",").map((t: string) => t.trim()).filter(Boolean)) : [],
        author: img.author || "未知",
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${img.author || img.id}`,
        media_type: img.media_type || "image",
      };
      setExtraImages((prev) => [...prev, newImg]);
      const newIndex = allImages.length;
      setOverrideIndex(newIndex);
      setSimilarOpen(false);
      setIsLoaded(false);
    }
  };

  return {
    allImages,
    activeIndex,
    currentImage,
    isLoaded,
    setIsLoaded,
    reportOpen,
    setReportOpen,
    reportReason,
    setReportReason,
    reportCategory,
    setReportCategory,
    submitting,
    shareOpen,
    setShareOpen,
    isFollowing,
    followersCount,
    loadingFollowStatus,
    addToCollectionOpen,
    setAddToCollectionOpen,
    commentOpen,
    setCommentOpen,
    similarOpen,
    setSimilarOpen,
    exifOpen,
    setExifOpen,
    devicePreview,
    setDevicePreview,
    isPaidWallpaper,
    paidPrice,
    hasPurchased,
    setHasPurchased,
    paymentDialogOpen,
    setPaymentDialogOpen,
    downloadSuccessOpen,
    setDownloadSuccessOpen,
    isFavorited,
    handleFavorite,
    handleReport,
    handleToggleFollow,
    handleSimilarImageClick,
    REPORT_CATEGORIES,
  };
}
