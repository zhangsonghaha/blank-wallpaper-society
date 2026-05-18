"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Share2, UserPlus, Sparkles, X, Check,
  Smartphone, Monitor, ChevronRight, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import Link from "next/link";

interface DownloadSuccessGuideProps {
  imageId: number;
  imageTitle: string;
  uploadedBy: number | null;
  authorName: string;
  isOpen: boolean;
  onClose: () => void;
  isFavorited?: boolean;
  isFollowing?: boolean;
}

export default function DownloadSuccessGuide({
  imageId,
  imageTitle,
  uploadedBy,
  authorName,
  isOpen,
  onClose,
  isFavorited = false,
  isFollowing = false,
}: DownloadSuccessGuideProps) {
  const [favorited, setFavorited] = useState(isFavorited);
  const [following, setFollowing] = useState(isFollowing);
  const [copied, setCopied] = useState(false);
  const [showWallpaperTip, setShowWallpaperTip] = useState(false);

  // 收藏
  const toggleFavorite = useCallback(async () => {
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ is_favorite: !favorited }),
      });
      if (res.ok) {
        setFavorited(!favorited);
        toast.success(favorited ? "已取消收藏" : "已收藏");
      }
    } catch {
      toast.error("操作失败");
    }
  }, [favorited, imageId]);

  // 关注
  const toggleFollow = useCallback(async () => {
    if (!uploadedBy) return;
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ action: following ? "unfollow" : "follow", userId: uploadedBy }),
      });
      if (res.ok) {
        setFollowing(!following);
        toast.success(following ? "已取消关注" : "已关注");
      }
    } catch {
      toast.error("操作失败");
    }
  }, [following, uploadedBy]);

  // 复制链接
  const copyLink = useCallback(async () => {
    const url = `${window.location.origin}/images/${imageId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("链接已复制");
    setTimeout(() => setCopied(false), 2000);
  }, [imageId]);

  // Web Share API
  const nativeShare = useCallback(async () => {
    const url = `${window.location.origin}/images/${imageId}`;
    if (navigator.share) {
      await navigator.share({
        title: imageTitle,
        text: `${imageTitle} - ImageGallery 精选壁纸`,
        url,
      });
    } else {
      await copyLink();
    }
  }, [imageId, imageTitle, copyLink]);

  // 检测设备类型
  const isMobile = typeof window !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);

  if (!isOpen) return null;

  const actions = [
    {
      id: "favorite",
      icon: Heart,
      label: favorited ? "已收藏" : "收藏壁纸",
      description: "收藏后可随时在个人中心查看",
      color: favorited ? "text-red-500" : "text-[var(--color-ink)]",
      bgColor: favorited ? "bg-red-50 dark:bg-red-900/10" : "bg-[var(--color-surface-card)]",
      done: favorited,
      onClick: toggleFavorite,
    },
    {
      id: "share",
      icon: Share2,
      label: "分享给朋友",
      description: "让更多人发现精美壁纸",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/10",
      done: copied,
      onClick: nativeShare,
    },
    ...(uploadedBy ? [{
      id: "follow",
      icon: UserPlus,
      label: following ? `已关注 ${authorName}` : `关注 ${authorName}`,
      description: "关注创作者，获取最新作品",
      color: following ? "text-green-500" : "text-[var(--color-ink)]",
      bgColor: following ? "bg-green-50 dark:bg-green-900/10" : "bg-[var(--color-surface-card)]",
      done: following,
      onClick: toggleFollow,
    }] : []),
    {
      id: "similar",
      icon: Sparkles,
      label: "发现相似壁纸",
      description: "基于风格和色彩推荐",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/10",
      done: false,
      onClick: () => {},
      isLink: true,
      link: `/images/${imageId}`,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-[var(--color-surface-soft)] rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full mx-0 sm:mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--color-mute)]" />
            </button>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-ink)]">下载成功</h3>
              <p className="text-sm text-[var(--color-mute)] mt-1">{imageTitle}</p>
            </div>
          </div>

          {/* 互动引导 */}
          <div className="px-6 pb-4 space-y-2">
            {actions.map((action) => {
              const ActionIcon = action.icon;
              return action.isLink ? (
                <Link key={action.id} href={action.link} onClick={onClose}>
                  <div className={`flex items-center gap-3 p-3 rounded-xl ${action.bgColor} cursor-pointer hover:opacity-80 transition-opacity`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.bgColor}`}>
                      <ActionIcon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-ink)]">{action.label}</p>
                      <p className="text-xs text-[var(--color-mute)]">{action.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--color-mute)]" />
                  </div>
                </Link>
              ) : (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl ${action.bgColor} hover:opacity-80 transition-opacity text-left`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${action.bgColor}`}>
                    {action.done ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <ActionIcon className={`w-5 h-5 ${action.color}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${action.done ? "text-[var(--color-mute)] line-through" : "text-[var(--color-ink)]"}`}>
                      {action.label}
                    </p>
                    <p className="text-xs text-[var(--color-mute)]">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 设壁纸引导 */}
          <div className="px-6 pb-4">
            <button
              onClick={() => setShowWallpaperTip(!showWallpaperTip)}
              className="w-full flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-card)] text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
            >
              {isMobile ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              <span>如何设为壁纸？</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${showWallpaperTip ? "rotate-90" : ""}`} />
            </button>
            <AnimatePresence>
              {showWallpaperTip && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 text-xs text-[var(--color-mute)] leading-relaxed bg-[var(--color-surface-card)] rounded-xl mt-2">
                    {isMobile ? (
                      <ol className="list-decimal list-inside space-y-1">
                        <li>打开手机「设置」→「壁纸」</li>
                        <li>选择「从相册选取」</li>
                        <li>选择刚下载的壁纸图片</li>
                        <li>调整位置后点击「设定」</li>
                      </ol>
                    ) : (
                      <ol className="list-decimal list-inside space-y-1">
                        <li>右键点击桌面空白处 →「个性化」</li>
                        <li>点击「浏览」选择下载的图片</li>
                        <li>选择适应模式并保存</li>
                      </ol>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 关闭按钮 */}
          <div className="px-6 pb-6">
            <Button variant="outline" className="w-full rounded-full" onClick={onClose}>
              关闭
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}