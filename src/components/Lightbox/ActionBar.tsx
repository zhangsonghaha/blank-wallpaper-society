"use client";

import type { GalleryImage } from "@/data/images";
import { CATEGORY_LABELS, type Resolution } from "@/lib/resolutions";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag, Download, ChevronDown, Monitor, Smartphone, Tablet,
  X, FolderPlus, Pencil, Calendar, MessageCircle, Sparkles,
  UserPlus, UserCheck,
} from "lucide-react";
import type { RefObject } from "react";
import type { ResolutionWithCache } from "./types";

interface ActionBarProps {
  currentImage: GalleryImage;
  isFavorited: boolean;
  isPaidWallpaper: boolean;
  hasPurchased: boolean;
  paidPrice: number;
  isFollowing: boolean;
  loadingFollowStatus: boolean;
  downloadPanelOpen: boolean;
  setDownloadPanelOpen: (v: boolean) => void;
  loadingResolutions: boolean;
  groupedResolutions: Record<string, ResolutionWithCache[]>;
  recommendedResolution: Resolution | null;
  downloadingRes: string | null;
  downloadProgress: number;
  downloadBtnRef: RefObject<HTMLButtonElement | null>;
  downloadPanelRef: RefObject<HTMLDivElement | null>;
  downloadPanelPos: { top: number; left: number } | null;
  handleDownloadResolution: (resolution?: string) => void;
  handleFavorite: () => void;
  handleToggleFollow: () => void;
  onToggleFavorite?: (id: number) => void;
  setReportOpen: (v: boolean) => void;
  setAddToCollectionOpen: (v: boolean) => void;
  setShareOpen: (v: boolean) => void;
  setCommentOpen: (v: boolean) => void;
  setSimilarOpen: (v: boolean) => void;
  setPaymentDialogOpen: (v: boolean) => void;
}

const CATEGORY_ICONS = {
  phone: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
} as const;

export default function ActionBar({
  currentImage,
  isFavorited,
  isPaidWallpaper,
  hasPurchased,
  paidPrice,
  isFollowing,
  loadingFollowStatus,
  downloadPanelOpen,
  setDownloadPanelOpen,
  loadingResolutions,
  groupedResolutions,
  recommendedResolution,
  downloadingRes,
  downloadProgress,
  downloadBtnRef,
  downloadPanelRef,
  downloadPanelPos,
  handleDownloadResolution,
  handleFavorite,
  handleToggleFollow,
  onToggleFavorite,
  setReportOpen,
  setAddToCollectionOpen,
  setShareOpen,
  setCommentOpen,
  setSimilarOpen,
  setPaymentDialogOpen,
}: ActionBarProps) {

  return (
    <div className="absolute bottom-2 sm:bottom-4 left-0 sm:left-1/2 sm:-translate-x-1/2 z-[60] w-full sm:w-auto sm:max-w-[90vw] px-2 sm:px-0 pointer-events-none">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-max sm:min-w-0 sm:flex-wrap sm:justify-center overflow-x-auto scrollbar-none pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {/* Favorite */}
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); handleFavorite(); }}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm ${
              isFavorited
                ? "bg-[var(--color-primary)] text-white dark:bg-white dark:text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="hidden sm:inline">{isFavorited ? "已收藏" : "收藏"}</span>
          </button>
        )}

        {/* Edit */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const params = new URLSearchParams({ src: currentImage.src, width: String(currentImage.width), height: String(currentImage.height), id: String(currentImage.id) });
            window.open(`/editor?${params.toString()}`, "_blank");
          }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">编辑</span>
        </button>

        {/* Calendar */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const params = new URLSearchParams({ src: currentImage.src, width: String(currentImage.width), height: String(currentImage.height), id: String(currentImage.id) });
            window.open(`/editor/calendar?${params.toString()}`, "_blank");
          }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">日历</span>
        </button>

        {/* Collection */}
        <button
          onClick={(e) => { e.stopPropagation(); setAddToCollectionOpen(true); }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <FolderPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">合集</span>
        </button>

        {/* Share */}
        <button
          onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="hidden sm:inline">分享</span>
        </button>

        {/* Comment */}
        <button
          onClick={(e) => { e.stopPropagation(); setCommentOpen(true); }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">评论</span>
        </button>

        {/* Similar */}
        <button
          onClick={(e) => { e.stopPropagation(); setSimilarOpen(true); }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">相似</span>
        </button>

        {/* Download Button with Panel */}
        <div className="relative z-30">
          <button
            ref={downloadBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              if (isPaidWallpaper && !hasPurchased) {
                setPaymentDialogOpen(true);
              } else {
                if (!downloadPanelOpen && downloadBtnRef.current) {
                  const rect = downloadBtnRef.current.getBoundingClientRect();
                  // setDownloadPanelPos handled by useResolutions
                }
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
                ref={downloadPanelRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed' as const,
                  bottom: downloadPanelPos ? `calc(100vh - ${downloadPanelPos.top}px)` : undefined,
                  left: downloadPanelPos?.left,
                  transform: 'translateX(-50%)',
                  maxHeight: downloadPanelPos ? `calc(${downloadPanelPos.top}px - 0.75rem)` : undefined,
                }}
                className="w-72 max-w-[calc(100vw-1rem)] z-[120] bg-[var(--color-canvas,#fff)] rounded-2xl shadow-2xl border border-[var(--color-hairline,#e5e5e5)] overflow-hidden flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline,#e5e5e5)] shrink-0">
                  <h4 className="text-sm font-semibold text-[var(--color-ink,#1a1a1a)]">选择分辨率</h4>
                  <button onClick={() => setDownloadPanelOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-soft,#f5f5f5)] text-[var(--color-ink,#1a1a1a)]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {currentImage.media_type !== "video" && (
                  <div className="flex-1 overflow-y-auto p-2">
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
                        const Icon = CATEGORY_ICONS[category];
                        return (
                          <div key={category} className="mb-2 last:mb-0">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[var(--color-ash,#999)]">
                              <Icon className="w-3.5 h-3.5" />
                              {CATEGORY_LABELS[category]}
                            </div>
                            {group.map((res) => {
                              const resKey = `${res.width}x${res.height}`;
                              const isRecommended = recommendedResolution && recommendedResolution.width === res.width && recommendedResolution.height === res.height;
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
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white dark:bg-white dark:text-black font-medium">推荐</span>
                                    )}
                                  </div>
                                  {isDownloading ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-16 h-1.5 rounded-full bg-[var(--color-hairline,#e5e5e5)] overflow-hidden">
                                        <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${downloadProgress}%` }} />
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

                <div className={`shrink-0 ${currentImage.media_type !== "video" ? "border-t border-[var(--color-hairline,#e5e5e5)] p-2" : "p-2"}`}>
                  <button
                    onClick={() => handleDownloadResolution()}
                    disabled={downloadingRes !== null}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-[var(--color-surface-soft,#f5f5f5)] disabled:opacity-50 group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-ink,#1a1a1a)] font-medium">{currentImage.media_type === "video" ? "原视频" : "原图"}</span>
                      <span className="text-[10px] text-[var(--color-ash,#999)]">{currentImage.width}×{currentImage.height}</span>
                    </div>
                    {downloadingRes === "original" ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-[var(--color-hairline,#e5e5e5)] overflow-hidden">
                          <div className="h-full bg-[var(--color-primary)] rounded-full transition-all" style={{ width: `${downloadProgress}%` }} />
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

        {/* Follow */}
        {currentImage?.uploaded_by && (
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleFollow(); }}
            disabled={loadingFollowStatus}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm ${
              isFollowing ? "bg-[var(--color-primary)] text-white dark:bg-white dark:text-black" : "bg-white/10 text-white hover:bg-white/20"
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

        {/* Report */}
        <button
          onClick={(e) => { e.stopPropagation(); setReportOpen(true); }}
          className="px-3 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1 sm:gap-2 rounded-full bg-white/10 text-white text-xs sm:text-sm font-medium hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">举报</span>
        </button>
      </div>
    </div>
  );
}
