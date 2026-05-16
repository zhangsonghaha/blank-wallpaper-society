"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
  Globe,
  Users,
  Lock,
  Play,
  Send,
  CornerDownRight,
  Loader2,
  X,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import PostEditor from "./PostEditor";
import ImagePreview from "./ImagePreview";
import { withCsrfHeader } from "@/lib/csrf-client";

interface PostCardProps {
  post: any;
  onUpdated?: (post: any) => void;
  onDeleted?: (postId: number) => void;
}

const VISIBILITY_ICONS: Record<string, any> = {
  public: Globe,
  followers: Users,
  private: Lock,
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "公开",
  followers: "仅关注者",
  private: "仅自己",
};

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function linkifyContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-primary)] hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function PostCard({ post, onUpdated, onDeleted }: PostCardProps) {
  const { data: session } = useSession();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 评论面板状态
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // 分享面板状态
  const [showShareMenu, setShowShareMenu] = useState(false);

  // 图片预览状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 附件中图片/视频列表（用于预览）
  const previewImages = (post.attachments || []).map((att: any) => ({
    url: att.url,
    type: att.type,
  }));

  const isOwner = session?.user && Number((session.user as any).id) === post.user_id;
  const isAdmin = session?.user && (session.user as any).role === "admin";
  const canEdit = isOwner || isAdmin;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) {
      toast.error("请先登录");
      return;
    }
    setIsLiked(!isLiked);
    setLikesCount((prev: number) => (isLiked ? prev - 1 : prev + 1));
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST", headers: { ...csrfHeaders } });
      if (!res.ok) {
        setIsLiked(isLiked);
        setLikesCount(likesCount);
      }
    } catch {
      setIsLiked(isLiked);
      setLikesCount(likesCount);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这条动态吗？")) return;
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE", headers: { ...csrfHeaders } });
      if (res.ok) {
        toast.success("删除成功");
        onDeleted?.(post.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
    setShowMenu(false);
  };

  // 分享功能
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/feed?post=${post.id}`;
  const shareTitle = post.content ? post.content.slice(0, 50) : "动态分享";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("链接已复制到剪贴板");
    } catch {
      // clipboard API 可能不可用，用 textarea 回退
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("链接已复制到剪贴板");
    }
    setShowShareMenu(false);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
      } catch {}
    }
    setShowShareMenu(false);
  };

  const handleWechatShare = () => {
    handleCopyLink();
    toast.success("链接已复制，可粘贴到微信分享");
    setShowShareMenu(false);
  };

  // 评论功能
  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.data || []);
      }
    } catch (err) {
      console.error("获取评论失败:", err);
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleComments = () => {
    if (!showComments) {
      fetchComments();
    }
    setShowComments(!showComments);
  };

  const handleSubmitComment = async () => {
    if (!session?.user) {
      toast.error("请先登录");
      return;
    }
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          content: commentText.trim(),
          parent_id: replyTo?.id || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("评论成功");
        setCommentText("");
        setReplyTo(null);
        setCommentsCount((prev: number) => prev + 1);
        // 刷新评论列表
        fetchComments();
      } else {
        toast.error(data.error || "评论失败");
      }
    } catch {
      toast.error("评论失败");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = (comment: any) => {
    setReplyTo(comment);
    commentInputRef.current?.focus();
  };

  const handlePostUpdated = (updatedPost: any) => {
    setIsEditing(false);
    onUpdated?.(updatedPost);
  };

  useEffect(() => {
    // 关闭菜单（点击外部时）
    const handleClickOutside = () => {
      setShowMenu(false);
      setShowShareMenu(false);
    };
    if (showMenu || showShareMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showMenu, showShareMenu]);

  if (isEditing) {
    return (
      <div className="mb-4">
        <PostEditor
          editPost={post}
          onPostCreated={handlePostUpdated}
          onCancelEdit={() => setIsEditing(false)}
        />
      </div>
    );
  }

  const VisibilityIcon = VISIBILITY_ICONS[post.visibility] || Globe;
  const isContentLong = post.content && post.content.length > 300;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-[var(--color-hairline)] shadow-sm overflow-hidden mb-4"
    >
      {/* 头部：用户信息 + 操作 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Link
            href={`/creator/${post.user_id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-10 h-10 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-transparent hover:ring-[var(--color-primary)] transition-all"
          >
            {post.author_avatar ? (
              <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[var(--color-ink)] text-sm font-medium">
                {post.author_name?.[0] || "?"}
              </span>
            )}
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/creator/${post.user_id}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)] transition-colors"
              >
                {post.author_name || "匿名用户"}
              </Link>
              <VisibilityIcon className="w-3 h-3 text-[var(--color-ash)]" title={VISIBILITY_LABELS[post.visibility]} />
            </div>
            <span className="text-xs text-[var(--color-ash)]">
              {formatTime(post.created_at)}
              {post.updated_at !== post.created_at && " (已编辑)"}
            </span>
          </div>
        </div>

        {/* 更多操作 */}
        {canEdit && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4 text-[var(--color-mute)]" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[var(--color-hairline)] overflow-hidden z-10 min-w-[120px]"
                >
                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-card)] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      编辑
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 内容 */}
      {post.content && (
        <div className="px-4 pb-2">
          <div className={`text-sm text-[var(--color-body)] leading-relaxed whitespace-pre-wrap break-words ${!showFullContent && isContentLong ? "line-clamp-5" : ""}`}>
            {linkifyContent(post.content)}
          </div>
          {isContentLong && (
            <button
              onClick={() => setShowFullContent(!showFullContent)}
              className="text-xs font-semibold text-[var(--color-primary)] mt-1 hover:underline"
            >
              {showFullContent ? "收起" : "展开全文"}
            </button>
          )}
        </div>
      )}

      {/* 附件（图片/视频） */}
      {post.attachments && post.attachments.length > 0 && (
        <div className="px-4 pb-2">
          <div className={`grid gap-2 ${
            post.attachments.length === 1 ? "grid-cols-1" :
            post.attachments.length === 2 ? "grid-cols-2" :
            post.attachments.length === 3 ? "grid-cols-3" :
            post.attachments.length === 4 ? "grid-cols-2" :
            "grid-cols-3"
          }`}>
            {post.attachments.map((att: any, idx: number) => (
              <div
                key={att.id || idx}
                className={`relative rounded-lg overflow-hidden bg-[var(--color-surface-card)] cursor-pointer group ${
                  post.attachments.length === 1 ? "max-h-[400px]" : "aspect-square"
                } ${post.attachments.length === 1 ? "" : "aspect-square"}`}
                onClick={() => {
                  setPreviewIndex(idx);
                  setPreviewOpen(true);
                }}
              >
                {att.type === "video" ? (
                  <>
                    <video
                      ref={videoRef}
                      src={att.url}
                      poster={att.thumbnail_url || undefined}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                      onMouseEnter={() => videoRef.current?.play().catch(() => {})}
                      onMouseLeave={() => videoRef.current?.pause()}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      src={att.url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 链接预览 */}
      {post.link_previews && post.link_previews.length > 0 && (
        <div className="px-4 pb-2">
          {post.link_previews.map((link: any, idx: number) => (
            <a
              key={link.id || idx}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-hairline)] hover:bg-[var(--color-surface-card)] transition-colors group"
            >
              {link.image_url ? (
                <div className="w-12 h-12 rounded-md overflow-hidden bg-[var(--color-surface-card)] shrink-0">
                  <img src={link.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-md bg-[var(--color-surface-card)] flex items-center justify-center shrink-0">
                  <Link2 className="w-5 h-5 text-[var(--color-ash)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                  {link.title || link.url}
                </p>
                {link.description && (
                  <p className="text-xs text-[var(--color-ash)] truncate mt-0.5">{link.description}</p>
                )}
                {link.site_name && (
                  <p className="text-[10px] text-[var(--color-ash)] mt-0.5">{link.site_name}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* 交互按钮 */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-hairline-soft)]">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
            isLiked
              ? "text-red-500 font-semibold"
              : "text-[var(--color-mute)] hover:text-red-500"
          }`}
        >
          <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
          {likesCount > 0 && <span>{likesCount}</span>}
        </button>

        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
            showComments
              ? "text-[var(--color-primary)] font-semibold"
              : "text-[var(--color-mute)] hover:text-[var(--color-primary)]"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          {commentsCount > 0 && <span>{commentsCount}</span>}
        </button>

        {/* 分享按钮 */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShareMenu(!showShareMenu);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              showShareMenu
                ? "text-[var(--color-primary)] font-semibold"
                : "text-[var(--color-mute)] hover:text-[var(--color-primary)]"
            }`}
          >
            <Share2 className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showShareMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg border border-[var(--color-hairline)] overflow-hidden z-10 min-w-[140px]"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyLink();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-card)] transition-colors"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  复制链接
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWechatShare();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-card)] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.133 0 .241-.108.241-.243 0-.06-.023-.118-.039-.177l-.326-1.233a.493.493 0 0 1 .177-.554C23.025 18.078 24 16.336 24 14.417c0-3.137-2.727-5.439-7.062-5.559zM13.894 12.3c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.543.434-.983.97-.983zm4.844 0c.535 0 .969.44.969.983a.976.976 0 0 1-.97.983.976.976 0 0 1-.968-.983c0-.543.434-.983.969-.983z"/>
                  </svg>
                  微信分享
                </button>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNativeShare();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface-card)] transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    系统分享
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 评论区 */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[var(--color-hairline-soft)]"
          >
            {/* 评论输入框 */}
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0 overflow-hidden">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-[10px] font-medium">
                      {session?.user?.name?.[0] || "?"}
                    </span>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-2 bg-[var(--color-surface-card)] rounded-full px-3 py-1.5">
                  {replyTo && (
                    <span className="text-[10px] text-[var(--color-primary)] font-semibold shrink-0">
                      @{replyTo.user_name}
                    </span>
                  )}
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment();
                      }
                    }}
                    placeholder={replyTo ? `回复 @${replyTo.user_name}...` : "写评论..."}
                    className="flex-1 text-sm bg-transparent border-0 outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ash)]"
                  />
                  {replyTo && (
                    <button
                      onClick={() => setReplyTo(null)}
                      className="shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-[var(--color-ash)] hover:text-[var(--color-ink)]" />
                    </button>
                  )}
                  <button
                    onClick={handleSubmitComment}
                    disabled={submittingComment || !commentText.trim()}
                    className={`shrink-0 ${
                      submittingComment || !commentText.trim()
                        ? "text-[var(--color-ash)]"
                        : "text-[var(--color-primary)] hover:text-[var(--color-primary-pressed)]"
                    }`}
                  >
                    {submittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 评论列表 */}
            <div className="px-4 pb-3 max-h-[400px] overflow-y-auto">
              {commentsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ash)]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-ash)] py-4">暂无评论，来说点什么吧</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="group">
                      <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center shrink-0 overflow-hidden">
                          {comment.user_avatar ? (
                            <img src={comment.user_avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-[var(--color-ink)] font-medium">
                              {comment.user_name?.[0] || "?"}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--color-ink)]">
                              {comment.user_name || "匿名"}
                            </span>
                            <span className="text-[10px] text-[var(--color-ash)]">
                              {formatTime(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-body)] mt-0.5 leading-relaxed break-words">
                            {comment.content}
                          </p>
                          <button
                            onClick={() => handleReply(comment)}
                            className="text-[10px] text-[var(--color-ash)] hover:text-[var(--color-primary)] mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            回复
                          </button>
                        </div>
                      </div>

                      {/* 回复列表 */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-9 mt-2 space-y-2 pl-3 border-l-2 border-[var(--color-hairline-soft)]">
                          {comment.replies.map((reply: any) => (
                            <div key={reply.id} className="flex gap-2 group">
                              <div className="w-5 h-5 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center shrink-0 overflow-hidden">
                                {reply.user_avatar ? (
                                  <img src={reply.user_avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] text-[var(--color-ink)] font-medium">
                                    {reply.user_name?.[0] || "?"}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-semibold text-[var(--color-ink)]">
                                    {reply.user_name || "匿名"}
                                  </span>
                                  <span className="text-[9px] text-[var(--color-ash)]">
                                    {formatTime(reply.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--color-body)] mt-0.5 leading-relaxed break-words">
                                  {reply.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

      {/* 图片预览灯箱 */}
      <ImagePreview
        images={previewImages}
        initialIndex={previewIndex}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}