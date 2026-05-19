"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { GalleryImage } from "@/data/images";
import { Flag, Download, ChevronDown, Monitor, Smartphone, Tablet, X, FolderPlus, Pencil, Calendar, MessageCircle, Sparkles, UserPlus, UserCheck, Camera, ChevronUp, MonitorSmartphone } from "lucide-react";
import DeviceMockup, { type DeviceType } from "./DeviceMockup";
import DeviceSelector from "./DeviceSelector";
import Link from "next/link";
import AddToCollectionDialog from "./AddToCollectionDialog";
import CommentSection from "./CommentSection";
import SimilarImages from "./SimilarImages";
import PaymentDialog from "./PaymentDialog";
import {
  RESOLUTIONS,
  CATEGORY_LABELS,
  type Resolution,
} from "@/lib/resolutions";
import { withCsrfHeader } from "@/lib/csrf-client";

interface LightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  favoritedIds?: Set<number>;
  onToggleFavorite?: (id: number) => void;
}

interface ResolutionWithCache extends Resolution {
  cached?: boolean;
}

export default function Lightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onPrev,
  onNext,
  favoritedIds,
  onToggleFavorite,
}: LightboxProps) {
  const currentImage = images[currentIndex];
  const [isLoaded, setIsLoaded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportCategory, setReportCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 关注状态
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [loadingFollowStatus, setLoadingFollowStatus] = useState(false);

  // 下载面板状态
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false);
  const [resolutions, setResolutions] = useState<ResolutionWithCache[]>([]);
  const [downloadingRes, setDownloadingRes] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [loadingResolutions, setLoadingResolutions] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [similarOpen, setSimilarOpen] = useState(false);
  const [exifOpen, setExifOpen] = useState(false);

  // 设备预览状态
  const [devicePreview, setDevicePreview] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>("desktop");

  // 付费壁纸状态
  const [isPaidWallpaper, setIsPaidWallpaper] = useState(false);
  const [paidPrice, setPaidPrice] = useState(0);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const isFavorited = favoritedIds?.has(currentImage?.id) ?? false;

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

  // 举报原因分类
  const reportCategories = [
    { value: "inappropriate", label: "不当内容" },
    { value: "copyright", label: "版权侵权" },
    { value: "spam", label: "垃圾信息" },
    { value: "violence", label: "暴力血腥" },
    { value: "other", label: "其他" },
  ];

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
      // 静默失败，使用默认列表
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
      
      // Escape 键优先处理，逐层关闭弹窗
      if (e.key === "Escape") {
        if (downloadPanelOpen) {
          setDownloadPanelOpen(false);
          return;
        }
        if (reportOpen) {
          setReportOpen(false);
          return;
        }
        if (addToCollectionOpen) {
          setAddToCollectionOpen(false);
          return;
        }
        if (commentOpen) {
          setCommentOpen(false);
          return;
        }
        if (similarOpen) {
          setSimilarOpen(false);
          return;
        }
        if (exifOpen) {
          setExifOpen(false);
          return;
        }
        if (devicePreview) {
          setDevicePreview(false);
          return;
        }
        // 所有弹窗都关闭后再关闭lightbox
        onClose();
        return;
      }
      
      // 其他快捷键只有在没有弹窗打开时才生效
      if (downloadPanelOpen || reportOpen || addToCollectionOpen || commentOpen || similarOpen || exifOpen || devicePreview) return;
      
      switch (e.key) {
        case "ArrowLeft":
          if (!devicePreview) onPrev();
          break;
        case "ArrowRight":
          if (!devicePreview) onNext();
          break;
      }
    },
    [isOpen, onClose, onPrev, onNext, downloadPanelOpen, reportOpen, addToCollectionOpen, commentOpen, similarOpen, exifOpen, devicePreview]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setIsLoaded(false);
      // 记录浏览日志
      if (currentImage?.id) {
        trackView(currentImage.id);
      }
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // 重置加载状态当图片切换
  useEffect(() => {
    setIsLoaded(false);
    setDownloadPanelOpen(false);
    setDownloadingRes(null);
    setDownloadProgress(0);
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
  }, [currentIndex]);

  // 获取作者关注状态
  useEffect(() => {
    if (!currentImage?.uploaded_by) return;

    setLoadingFollowStatus(true);
    // 获取关注状态和粉丝数
    fetch(`/api/users/${currentImage.uploaded_by}/follow`)
      .then((res) => res.json())
      .then((data) => {
        setIsFollowing(data.isFollowing || false);
        setFollowersCount(data.followers || 0);
        setLoadingFollowStatus(false);
      })
      .catch(() => setLoadingFollowStatus(false));
  }, [currentImage?.uploaded_by]);

  // 下载指定分辨率
  const handleDownloadResolution = async (resolution?: string) => {
    if (!currentImage || downloadingRes) return;

    // 付费壁纸且未购买 → 打开支付弹窗
    if (isPaidWallpaper && !hasPurchased) {
      setPaymentDialogOpen(true);
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

      // 402 = 付费壁纸未购买
      if (response.status === 402) {
        const data = await response.json();
        setIsPaidWallpaper(true);
        setPaidPrice(data.price);
        setPaymentDialogOpen(true);
        return;
      }

      if (!response.ok) {
        throw new Error("下载失败");
      }

      const contentLength = response.headers.get("Content-Length");
      const total = contentLength ? parseInt(contentLength) : 0;

      if (total && typeof ReadableStream !== "undefined") {
        // 带进度的下载
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
        // 降级：无进度
        const blob = await response.blob();
        triggerDownload(blob, resolution);
      }

      toast.success(resolution ? `已下载 ${resolution}` : "原图下载完成");

      // 记录下载日志（异步，不阻塞）
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

  const handleFavorite = () => {
    if (onToggleFavorite && currentImage) {
      onToggleFavorite(currentImage.id);
    }
  };

  const handleShare = () => {
    if (!currentImage) return;
    const url = `${window.location.origin}/?pin=${currentImage.id}`;
    if (navigator.share) {
      navigator.share({
        title: currentImage.title,
        text: currentImage.description || `查看 ${currentImage.title}`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("链接已复制到剪贴板");
      }).catch(() => {
        toast.error("复制失败");
      });
    }
  };

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
          reason: `[${reportCategories.find(c => c.value === reportCategory)?.label || reportCategory}] ${reportReason.trim()}`,
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

  const handleToggleFollow = async () => {
    if (!currentImage?.uploaded_by) return;

    const newFollowing = !isFollowing;
    // 乐观更新UI
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
        // 回滚
        setIsFollowing(!newFollowing);
        setFollowersCount(prev => newFollowing ? prev - 1 : prev + 1);
        toast.error("操作失败，请重试");
      } else {
        const data = await res.json();
        setFollowersCount(data.followers || (newFollowing ? followersCount + 1 : followersCount - 1));
        toast.success(newFollowing ? "已关注" : "已取消关注");
      }
    } catch {
      // 回滚
      setIsFollowing(!newFollowing);
      setFollowersCount(prev => newFollowing ? prev - 1 : prev + 1);
      toast.error("网络错误，请重试");
    }
  };

  const categoryIcons = {
    phone: Smartphone,
    desktop: Monitor,
    tablet: Tablet,
  };

  return (
    <AnimatePresence>
      {isOpen && currentImage && (
        <motion.div
          key={`lightbox-${currentImage.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => {
            if (downloadPanelOpen) {
              setDownloadPanelOpen(false);
            } else if (reportOpen) {
              setReportOpen(false);
            } else if (addToCollectionOpen) {
              setAddToCollectionOpen(false);
            } else if (commentOpen) {
              setCommentOpen(false);
            } else if (similarOpen) {
              setSimilarOpen(false);
            } else if (exifOpen) {
              setExifOpen(false);
            } else if (devicePreview) {
              setDevicePreview(false);
            } else {
              onClose();
            }
          }}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/40 text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Prev Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all hover:scale-105"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all hover:scale-105"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Image Container */}
          <motion.div
            key={`image-container-${currentImage.id}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative max-w-[95vw] sm:max-w-[90vw] max-h-[80vh] sm:max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 设备预览切换按钮 */}
            {!devicePreview && currentImage.media_type !== "video" && (
              <button
                onClick={(e) => { e.stopPropagation(); setDevicePreview(true); }}
                className="absolute top-3 right-3 z-10 px-3 py-1.5 flex items-center gap-1.5 rounded-full bg-black/50 text-white/80 text-xs font-medium hover:bg-black/70 hover:text-white transition-colors backdrop-blur-sm"
              >
                <MonitorSmartphone className="w-3.5 h-3.5" />
                设备预览
              </button>
            )}

            {/* 设备预览模式 */}
            {devicePreview ? (
              <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
                {/* 退出设备预览按钮 */}
                <button
                  onClick={() => setDevicePreview(false)}
                  className="px-3 py-1.5 flex items-center gap-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  退出设备预览
                </button>

                {/* 设备 Mockup */}
                <DeviceMockup
                  imageUrl={currentImage.src}
                  imageWidth={currentImage.width}
                  imageHeight={currentImage.height}
                  deviceType={selectedDevice}
                />

                {/* 设备选择器 */}
                <DeviceSelector
                  selected={selectedDevice}
                  onSelect={setSelectedDevice}
                />
              </div>
            ) : (
              <>
                {/* Loading Skeleton */}
                {!isLoaded && (
                  <div className="w-[60vw] sm:w-[500px] h-[60vh] sm:h-[600px] rounded-2xl skeleton-pulse bg-white/10" />
                )}

                {/* 动态壁纸或静态图片 */}
                {currentImage.media_type === "video" && currentImage.video_url ? (
                  <video
                    key={`video-${currentImage.id}`}
                    src={currentImage.video_url}
                    poster={currentImage.poster_url || currentImage.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                    onLoadedData={() => setIsLoaded(true)}
                    className={`max-w-full max-h-[60vh] sm:max-h-[75vh] object-contain rounded-lg sm:rounded-2xl shadow-2xl ${
                      isLoaded ? "opacity-100" : "opacity-0 absolute"
                    }`}
                  />
                ) : (
                  <img
                    src={currentImage.src}
                    alt={currentImage.title}
                    onLoad={() => setIsLoaded(true)}
                    className={`max-w-full max-h-[60vh] sm:max-h-[75vh] object-contain rounded-lg sm:rounded-2xl shadow-2xl ${
                      isLoaded ? "opacity-100" : "opacity-0 absolute"
                    }`}
                  />
                )}

                {/* 动态壁纸标识 */}
                {currentImage.media_type === "video" && (
                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-1 rounded-full">
                      LIVE
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Image Info */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-2 sm:mt-4 text-white text-center max-w-sm sm:max-w-lg px-4"
            >
              <h3 className="text-base sm:text-xl font-semibold">{currentImage.title}</h3>
              <p className="text-xs sm:text-sm text-white/70 mt-1 line-clamp-2">{currentImage.description}</p>
              <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 sm:mt-3 flex-wrap">
                <Link
                  href={currentImage.uploaded_by ? `/creator/${currentImage.uploaded_by}` : "#"}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-6 h-6 rounded-full bg-white/20 overflow-hidden">
                    <img src={currentImage.avatar} alt={currentImage.author} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm text-white/80">{currentImage.author}</span>
                </Link>
                <span className="text-white/30">·</span>
                <div className="flex gap-1.5">
                  {currentImage.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/70">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              {/* EXIF Info */}
              {currentImage.exif && (currentImage.exif.camera || currentImage.exif.lens || currentImage.exif.focalLength || currentImage.exif.aperture || currentImage.exif.iso) && (
                <div className="mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setExifOpen(!exifOpen); }}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mx-auto"
                  >
                    <Camera className="w-3 h-3" />
                    <span>EXIF 信息</span>
                    {exifOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {exifOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          {currentImage.exif.camera && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/50 shrink-0">相机</span>
                              <span className="text-white/90 truncate">{currentImage.exif.camera}</span>
                            </div>
                          )}
                          {currentImage.exif.lens && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/50 shrink-0">镜头</span>
                              <span className="text-white/90 truncate">{currentImage.exif.lens}</span>
                            </div>
                          )}
                          {currentImage.exif.focalLength && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/50 shrink-0">焦距</span>
                              <span className="text-white/90">{currentImage.exif.focalLength}mm</span>
                            </div>
                          )}
                          {currentImage.exif.aperture && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/50 shrink-0">光圈</span>
                              <span className="text-white/90">f/{currentImage.exif.aperture}</span>
                            </div>
                          )}
                          {currentImage.exif.shutterSpeed && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/50 shrink-0">快门</span>
                              <span className="text-white/90">{currentImage.exif.shutterSpeed}</span>
                            </div>
                          )}
                          {currentImage.exif.iso && (
                            <div className="flex items-center gap-2">
                              <span className="text-white/50 shrink-0">ISO</span>
                              <span className="text-white/90">{currentImage.exif.iso}</span>
                            </div>
                          )}
                          {currentImage.exif.dateTaken && (
                            <div className="flex items-center gap-2 col-span-2">
                              <span className="text-white/50 shrink-0">拍摄时间</span>
                              <span className="text-white/90">{currentImage.exif.dateTaken}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Bottom Action Bar - 移动端可滚动 */}
          <div className="absolute bottom-2 sm:bottom-4 left-0 sm:left-1/2 sm:-translate-x-1/2 z-10 w-full sm:w-auto sm:max-w-[90vw] px-2 sm:px-0 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-max sm:min-w-0 sm:flex-wrap sm:justify-center">
              {/* Favorite Button */}
              {onToggleFavorite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite();
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm ${
                    isFavorited
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                    fill={isFavorited ? "currentColor" : "none"}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="hidden sm:inline">{isFavorited ? "已收藏" : "收藏"}</span>
                </button>
              )}

              {/* Edit Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const params = new URLSearchParams({
                    src: currentImage.src,
                    width: String(currentImage.width),
                    height: String(currentImage.height),
                    id: String(currentImage.id),
                  });
                  window.open(`/editor?${params.toString()}`, "_blank");
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">编辑</span>
              </button>

              {/* Calendar Wallpaper Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const params = new URLSearchParams({
                    src: currentImage.src,
                    width: String(currentImage.width),
                    height: String(currentImage.height),
                    id: String(currentImage.id),
                  });
                  window.open(`/editor/calendar?${params.toString()}`, "_blank");
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">日历</span>
              </button>

              {/* Add to Collection Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddToCollectionOpen(true);
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">合集</span>
              </button>

              {/* Share Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">分享</span>
              </button>

              {/* Comment Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentOpen(true);
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">评论</span>
              </button>

              {/* Similar Images Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSimilarOpen(true);
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">相似</span>
              </button>

              {/* Download Button with Panel */}
              <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPaidWallpaper && !hasPurchased) {
                    setPaymentDialogOpen(true);
                  } else {
                    setDownloadPanelOpen(!downloadPanelOpen);
                  }
                }}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full text-white text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm ${isPaidWallpaper && !hasPurchased ? "bg-amber-500 hover:bg-amber-600" : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed,#c5001d)]"}`}
              >
                {isPaidWallpaper && !hasPurchased ? (
                  <>
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="hidden sm:inline">¥{paidPrice.toFixed(2)}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">下载</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${downloadPanelOpen ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>

              {/* Download Panel */}
              <AnimatePresence>
                {downloadPanelOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 bg-[var(--color-canvas,#fff)] rounded-2xl shadow-2xl border border-[var(--color-hairline,#e5e5e5)] overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline,#e5e5e5)]">
                      <h4 className="text-sm font-semibold text-[var(--color-ink,#1a1a1a)]">选择分辨率</h4>
                      <button
                        onClick={() => setDownloadPanelOpen(false)}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-soft,#f5f5f5)] text-[var(--color-ink,#1a1a1a)]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Resolution List - 视频不显示分辨率选择 */}
                    {currentImage.media_type !== "video" && (
                    <div className="max-h-[50vh] overflow-y-auto p-2">
                      {loadingResolutions ? (
                        <div className="flex items-center justify-center py-6">
                          <svg className="w-5 h-5 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="ml-2 text-sm text-[var(--color-ash,#999)]">加载中...</span>
                        </div>
                      ) : (
                        (["phone", "desktop", "tablet"] as const).map((category) => {
                          const group = groupedResolutions[category];
                          if (!group || group.length === 0) return null;
                          const Icon = categoryIcons[category];
                          return (
                            <div key={category} className="mb-2 last:mb-0">
                              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[var(--color-ash,#999)]">
                                <Icon className="w-3.5 h-3.5" />
                                {CATEGORY_LABELS[category]}
                              </div>
                              {group.map((res) => {
                                const resKey = `${res.width}x${res.height}`;
                                const isRecommended =
                                  recommendedResolution &&
                                  recommendedResolution.width === res.width &&
                                  recommendedResolution.height === res.height;
                                const isDownloading = downloadingRes === resKey;

                                return (
                                  <button
                                    key={resKey}
                                    onClick={() => handleDownloadResolution(resKey)}
                                    disabled={downloadingRes !== null}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors hover:bg-[var(--color-surface-soft,#f5f5f5)] disabled:opacity-50 group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[var(--color-ink,#1a1a1a)]">{res.label}</span>
                                      {isRecommended && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white font-medium">
                                          推荐
                                        </span>
                                      )}
                                    </div>
                                    {isDownloading ? (
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-16 h-1.5 rounded-full bg-[var(--color-hairline,#e5e5e5)] overflow-hidden">
                                          <div
                                            className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                                            style={{ width: `${downloadProgress}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-[var(--color-ash,#999)]">{downloadProgress}%</span>
                                      </div>
                                    ) : (
                                      <Download className="w-3.5 h-3.5 text-[var(--color-ash,#999)] group-hover:text-[var(--color-primary)]" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>
                    )}

                    {/* Original Download */}
                    <div className={currentImage.media_type !== "video" ? "border-t border-[var(--color-hairline,#e5e5e5)] p-2" : "p-2"}>
                      <button
                        onClick={() => handleDownloadResolution()}
                        disabled={downloadingRes !== null}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-[var(--color-surface-soft,#f5f5f5)] disabled:opacity-50 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--color-ink,#1a1a1a)] font-medium">
                            {currentImage.media_type === "video" ? "原视频" : "原图"}
                          </span>
                          <span className="text-[10px] text-[var(--color-ash,#999)]">
                            {currentImage.width}×{currentImage.height}
                          </span>
                        </div>
                        {downloadingRes === "original" ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 rounded-full bg-[var(--color-hairline,#e5e5e5)] overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                                style={{ width: `${downloadProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--color-ash,#999)]">{downloadProgress}%</span>
                          </div>
                        ) : (
                          <Download className="w-3.5 h-3.5 text-[var(--color-ash,#999)] group-hover:text-[var(--color-primary)]" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Follow Button */}  
            {currentImage?.uploaded_by && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFollow();
                }}
                disabled={loadingFollowStatus}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm ${
                  isFollowing
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {loadingFollowStatus ? (
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isFollowing ? (
                  <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
                <span className="hidden sm:inline">{isFollowing ? "已关注" : "关注"}</span>
              </button>
            )}

            {/* Report Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReportOpen(true);
              }}
              className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">举报</span>
            </button>
            </div>
          </div>

          {/* Report Dialog */}
          <AnimatePresence>
            {reportOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => setReportOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Flag className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--color-ink)]">举报图片</h3>
                        <p className="text-xs text-[var(--color-mute)]">我们会认真对待每一条举报</p>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">举报分类 *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {reportCategories.map((cat) => (
                          <button
                            key={cat.value}
                            onClick={() => setReportCategory(cat.value)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                              reportCategory === cat.value
                                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                                : "bg-white text-[var(--color-body)] border-[var(--color-hairline)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">详细说明</label>
                      <textarea
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        placeholder="请描述具体问题..."
                        maxLength={500}
                        className="w-full h-20 px-3 py-2 rounded-xl border border-[var(--color-hairline)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent placeholder:text-[var(--color-ash)]"
                      />
                      <p className="text-xs text-[var(--color-ash)] text-right mt-1">
                        {reportReason.length}/500
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setReportOpen(false);
                        setReportReason("");
                        setReportCategory("");
                      }}
                      className="px-4 py-2 text-sm font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] rounded-full hover:bg-[var(--color-surface-soft)] transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleReport}
                      disabled={submitting || !reportCategory}
                      className="px-5 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {submitting ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <Flag className="w-4 h-4" />
                      )}
                      提交举报
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add to Collection Dialog */}
      <AddToCollectionDialog
        key={`collection-dialog-${currentImage?.id ?? 0}`}
        open={addToCollectionOpen}
        onOpenChange={setAddToCollectionOpen}
        imageId={currentImage?.id ?? null}
      />

      {/* Comment Section */}
      {currentImage && (
        <CommentSection
          key={`comment-section-${currentImage.id}`}
          imageId={currentImage.id}
          isOpen={commentOpen}
          onClose={() => setCommentOpen(false)}
        />
      )}

      {/* Similar Images Panel */}
      {currentImage && (
        <SimilarImages
          key={`similar-${currentImage.id}`}
          imageId={currentImage.id}
          isOpen={similarOpen}
          onClose={() => setSimilarOpen(false)}
          onImageClick={(img) => {
            // 点击相似图片时跳转到该图片
            const idx = images.findIndex((i) => i.id === img.id);
            if (idx >= 0) {
              setSimilarOpen(false);
              // 使用父组件的导航
            } else {
              // 如果图片不在当前列表中，打开新页面
              window.open(`/?pin=${img.id}`, "_blank");
            }
          }}
        />
      )}

      {/* Payment Dialog for Paid Wallpapers */}
      <PaymentDialog
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        orderType="paid_wallpaper"
        description={currentImage?.title || "付费壁纸"}
        amount={paidPrice}
        relatedId={currentImage?.id}
        onSuccess={() => {
          setHasPurchased(true);
          setPaymentDialogOpen(false);
        }}
      />
    </AnimatePresence>
  );
}