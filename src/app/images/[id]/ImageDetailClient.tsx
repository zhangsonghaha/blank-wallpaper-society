"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Download, Heart, Share2, UserPlus, UserCheck, Eye, Calendar,
  Tag, ChevronDown, MessageCircle, Image as ImageIcon, Monitor,
  FolderPlus, ArrowLeft, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CommentSection from "@/components/CommentSection";
import SimilarImages from "@/components/SimilarImages";
import { RESOLUTIONS, CATEGORY_LABELS } from "@/lib/resolutions";
import { withCsrfHeader } from "@/lib/csrf-client";

interface ImageData {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  tags: string[];
  category: string;
  author: string;
  authorAvatar: string;
  uploadedBy: number | null;
  dominantColor: string;
  downloadCount: number;
  viewCount: number;
  createdAt: string;
  mediaType: string;
  baseUrl: string;
}

interface ImageDetailClientProps {
  imageData: ImageData;
  imageId: string;
}

export default function ImageDetailClient({ imageData, imageId }: ImageDetailClientProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [downloadPanelOpen, setDownloadPanelOpen] = useState(false);
  const [downloadingRes, setDownloadingRes] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(true);
  const [similarOpen, setSimilarOpen] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 检查收藏状态
  useEffect(() => {
    async function checkFavorite() {
      try {
        const res = await fetch("/api/auth/profile");
        if (res.ok) {
          const user = await res.json();
          if (user.favorites) {
            setIsFavorited(user.favorites.some((f: any) => f.image_id === parseInt(imageId)));
          }
        }
      } catch {}
    }
    checkFavorite();
  }, [imageId]);

  // 检查关注状态
  useEffect(() => {
    async function checkFollow() {
      if (!imageData.uploadedBy) return;
      try {
        const res = await fetch(`/api/auth/profile`);
        if (res.ok) {
          const user = await res.json();
          if (user.following) {
            setIsFollowing(user.following.some((f: any) => f.following_id === imageData.uploadedBy));
          }
        }
      } catch {}
    }
    checkFollow();
  }, [imageData.uploadedBy]);

  // 切换收藏
  const toggleFavorite = useCallback(async () => {
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ is_favorite: !isFavorited }),
      });
      if (res.ok) {
        setIsFavorited(!isFavorited);
        toast.success(isFavorited ? "已取消收藏" : "已收藏");
      }
    } catch {
      toast.error("操作失败");
    }
  }, [isFavorited, imageId]);

  // 切换关注
  const toggleFollow = useCallback(async () => {
    if (!imageData.uploadedBy) return;
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ action: isFollowing ? "unfollow" : "follow", userId: imageData.uploadedBy }),
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        toast.success(isFollowing ? "已取消关注" : "已关注");
      }
    } catch {
      toast.error("操作失败");
    }
  }, [isFollowing, imageData.uploadedBy]);

  // 下载图片
  const handleDownload = useCallback(async (resolution?: string) => {
    const url = `/api/images/${imageId}/download${resolution ? `?resolution=${resolution}` : ""}`;
    setDownloadingRes(resolution || "original");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${imageData.title}_${resolution || "original"}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("下载成功！");
    } catch {
      toast.error("下载失败");
    } finally {
      setDownloadingRes(null);
    }
  }, [imageId, imageData.title]);

  // 分享功能
  const handleShare = useCallback(async (platform: string) => {
    const url = `${imageData.baseUrl}/images/${imageId}`;
    const text = `${imageData.title} - ImageGallery`;

    switch (platform) {
      case "native":
        if (navigator.share) {
          await navigator.share({ title: imageData.title, text, url });
        }
        break;
      case "wechat":
        await navigator.clipboard.writeText(url);
        toast.success("链接已复制，可粘贴到微信分享");
        break;
      case "weibo":
        window.open(`https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, "_blank");
        break;
      case "qq":
        window.open(`https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`, "_blank");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
        break;
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("链接已复制");
        break;
    }
    setShowShareMenu(false);
  }, [imageId, imageData]);

  const categoryLabel = CATEGORY_LABELS[imageData.category as keyof typeof CATEGORY_LABELS] || imageData.category;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)]">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-[var(--color-surface-card)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回首页</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleFavorite} className={isFavorited ? "text-red-500" : ""}>
              <Heart className={`w-4 h-4 mr-1 ${isFavorited ? "fill-current" : ""}`} />
              {isFavorited ? "已收藏" : "收藏"}
            </Button>
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setShowShareMenu(!showShareMenu)}>
                <Share2 className="w-4 h-4 mr-1" />
                分享
              </Button>
              <AnimatePresence>
                {showShareMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-2 bg-[var(--color-surface-elevated)] rounded-lg shadow-lg border border-[var(--color-border)] py-2 min-w-[160px] z-50"
                  >
                    {[
                      { key: "native", label: "系统分享" },
                      { key: "wechat", label: "微信" },
                      { key: "weibo", label: "微博" },
                      { key: "qq", label: "QQ" },
                      { key: "twitter", label: "Twitter" },
                      { key: "copy", label: "复制链接" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => handleShare(item.key)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：图片展示 */}
          <div className="lg:col-span-2">
            {/* 主图 */}
            <div className="relative rounded-xl overflow-hidden bg-black/5">
              <div
                className="relative flex items-center justify-center min-h-[400px] lg:min-h-[600px]"
                style={{ backgroundColor: imageData.dominantColor || "#f0f0f0" }}
              >
                {!imageLoaded && (
                  <div className="absolute inset-0 animate-pulse bg-[var(--color-surface-hover)]" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageData.imageUrl}
                  alt={`${imageData.title} - ${imageData.tags.join(", ")}`}
                  className={`max-w-full max-h-[80vh] object-contain transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </div>

            {/* 相似推荐 */}
            <div className="mt-8">
              <SimilarImages imageId={parseInt(imageId)} isOpen={similarOpen} onClose={() => setSimilarOpen(false)} />
            </div>
          </div>

          {/* 右侧：信息面板 */}
          <div className="space-y-6">
            {/* 标题和描述 */}
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-2">{imageData.title}</h1>
              {imageData.description && (
                <p className="text-[var(--color-mute)] leading-relaxed">{imageData.description}</p>
              )}
            </div>

            {/* 作者信息 */}
            {imageData.uploadedBy && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--color-surface-elevated)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-medium">
                  {imageData.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageData.authorAvatar} alt={imageData.author} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    imageData.author.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/creator/${imageData.uploadedBy}`} className="font-medium text-[var(--color-ink)] hover:text-[var(--color-primary)] truncate block">
                    {imageData.author}
                  </Link>
                  <p className="text-xs text-[var(--color-mute)]">创作者</p>
                </div>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  onClick={toggleFollow}
                >
                  {isFollowing ? (
                    <><UserCheck className="w-3 h-3 mr-1" />已关注</>
                  ) : (
                    <><UserPlus className="w-3 h-3 mr-1" />关注</>
                  )}
                </Button>
              </div>
            )}

            {/* 统计信息 */}
            <div className="flex items-center gap-4 text-sm text-[var(--color-mute)]">
              <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{imageData.viewCount} 次浏览</span>
              <span className="flex items-center gap-1"><Download className="w-4 h-4" />{imageData.downloadCount} 次下载</span>
              {imageData.createdAt && (
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(imageData.createdAt).toLocaleDateString("zh-CN")}</span>
              )}
            </div>

            {/* 分类 */}
            {imageData.category && (
              <div>
                <Link
                  href={`/?category=${imageData.category}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-sm hover:bg-[var(--color-primary)]/20 transition-colors"
                >
                  <ImageIcon className="w-3 h-3" />
                  {categoryLabel}
                </Link>
              </div>
            )}

            {/* 标签 */}
            {imageData.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[var(--color-mute)] mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />标签
                </h3>
                <div className="flex flex-wrap gap-2">
                  {imageData.tags.map((tag, i) => (
                    <Link
                      key={i}
                      href={`/?q=${encodeURIComponent(tag)}`}
                      className="px-2.5 py-1 rounded-full bg-[var(--color-surface-elevated)] text-sm text-[var(--color-ink)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 下载面板 */}
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={() => handleDownload()}
                disabled={downloadingRes !== null}
              >
                <Download className="w-4 h-4 mr-2" />
                {downloadingRes ? "下载中..." : "下载原画"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setDownloadPanelOpen(!downloadPanelOpen)}
              >
                <Monitor className="w-4 h-4 mr-2" />
                选择分辨率
                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${downloadPanelOpen ? "rotate-180" : ""}`} />
              </Button>

              <AnimatePresence>
                {downloadPanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {RESOLUTIONS.slice(0, 8).map((res) => (
                        <Button
                          key={res.id}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleDownload(res.value)}
                          disabled={downloadingRes !== null}
                        >
                          {res.label}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setAddToCollectionOpen(true)}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                添加到合集
              </Button>
            </div>

            {/* 评论区 */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <h3 className="text-lg font-medium text-[var(--color-ink)] mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                评论
              </h3>
              <CommentSection imageId={parseInt(imageId)} isOpen={commentOpen} onClose={() => setCommentOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}