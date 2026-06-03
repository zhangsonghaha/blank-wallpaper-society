"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Trash2, Reply, X, ThumbsUp, ArrowUpDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";

interface Comment {
  id: number;
  image_id: number;
  user_id: number;
  content: string;
  parent_id: number | null;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
  like_count: number;
  replies?: Comment[];
}

interface CommentSectionProps {
  imageId: number;
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
  return date.toLocaleDateString("zh-CN");
}

export default function CommentSection({
  imageId,
  isOpen,
  onClose,
}: CommentSectionProps) {
  const { data: session, status } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<"latest" | "hot">("latest");
  const [likedComments, setLikedComments] = useState<Set<number>>(new Set());

  const fetchComments = useCallback(async () => {
    if (!imageId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/images/${imageId}/comments?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {
      // 静默失败
    }
    setLoading(false);
  }, [imageId]);

  useEffect(() => {
    if (isOpen && imageId) {
      fetchComments();
    }
  }, [isOpen, imageId, fetchComments]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (status !== "authenticated") {
      toast.error("请先登录");
      return;
    }
    if (!newComment.trim()) {
      toast.error("请输入评论内容");
      return;
    }
    setSubmitting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/images/${imageId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          content: newComment.trim(),
          parent_id: replyTo?.id || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(replyTo ? "回复成功" : "评论成功");
        setNewComment("");
        setReplyTo(null);
        fetchComments();
      } else {
        toast.error(data.error || "评论失败");
      }
    } catch {
      toast.error("网络错误");
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { ...csrfHeaders },
      });
      if (res.ok) {
        toast.success("删除成功");
        fetchComments();
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const currentUserId = (session?.user as any)?.id;

  // 点赞评论
  const handleLike = async (commentId: number) => {
    if (status !== "authenticated") {
      toast.error("请先登录");
      return;
    }
    if (likedComments.has(commentId)) return; // 已点赞
    // 乐观更新
    setLikedComments((prev) => new Set(prev).add(commentId));
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, like_count: (c.like_count || 0) + 1 } : c
      ).map((c) => ({
        ...c,
        replies: c.replies?.map((r) =>
          r.id === commentId ? { ...r, like_count: (r.like_count || 0) + 1 } : r
        ),
      }))
    );
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/comments/${commentId}/like`, {
        method: "POST",
        headers: { ...csrfHeaders },
      });
      if (!res.ok) {
        // 回滚
        setLikedComments((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId ? { ...c, like_count: Math.max(0, (c.like_count || 0) - 1) } : c
          ).map((c) => ({
            ...c,
            replies: c.replies?.map((r) =>
              r.id === commentId ? { ...r, like_count: Math.max(0, (r.like_count || 0) - 1) } : r
            ),
          }))
        );
      }
    } catch {
      // 回滚
      setLikedComments((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
    }
  };

  // 排序后的评论
  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === "hot") return (b.like_count || 0) - (a.like_count || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <AnimatePresence>
      {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-[var(--color-surface-card)] shadow-2xl z-[110] flex flex-col"
          >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[var(--color-ink)]" />
              <h3 className="text-base font-semibold text-[var(--color-ink)]">
                评论
              </h3>
              {total > 0 && (
                <span className="text-sm text-[var(--color-mute)]">
                  ({total})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 排序切换 */}
              {comments.length > 1 && (
                <div className="inline-flex items-center bg-[var(--color-surface-card)] rounded-full p-0.5">
                  <button
                    onClick={() => setSortBy("latest")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${
                      sortBy === "latest"
                        ? "bg-black dark:bg-white text-white dark:text-black"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    最新
                  </button>
                  <button
                    onClick={() => setSortBy("hot")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-all ${
                      sortBy === "hot"
                        ? "bg-black dark:bg-white text-white dark:text-black"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    最热
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-mute)]" />
              </button>
            </div>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--color-mute)]">
                <MessageCircle className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">暂无评论，来说点什么吧</p>
              </div>
            ) : (
              sortedComments.map((comment) => (
                <div key={comment.id} className="group">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {comment.user_avatar ? (
                        <img
                          src={comment.user_avatar}
                          alt={comment.user_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-xs font-medium">
                          {comment.user_name?.[0] || "?"}
                        </span>
                      )}
                    </div>

                    {/* Comment Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          {comment.user_name}
                        </span>
                        <span className="text-[10px] text-[var(--color-ash)]">
                          {timeAgo(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-body)] mt-1 break-words">
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          onClick={() => setReplyTo(comment)}
                          className="text-[11px] text-[var(--color-mute)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-0.5"
                        >
                          <Reply className="w-3 h-3" />
                          回复
                        </button>
                        <button
                          onClick={() => handleLike(comment.id)}
                          className={`text-[11px] transition-colors flex items-center gap-0.5 ${
                            likedComments.has(comment.id)
                              ? "text-[var(--color-primary)]"
                              : "text-[var(--color-mute)] hover:text-[var(--color-primary)]"
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                          {(comment.like_count || 0) > 0 && comment.like_count}
                        </button>
                        {comment.user_id === currentUserId && (
                          <button
                            onClick={() => handleDelete(comment.id)}
                            className="text-[11px] text-[var(--color-mute)] hover:text-red-500 transition-colors flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-11 mt-3 space-y-3 border-l-2 border-[var(--color-hairline)] pl-4">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {reply.user_avatar ? (
                              <img
                                src={reply.user_avatar}
                                alt={reply.user_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[var(--color-mute)] text-[10px] font-medium">
                                {reply.user_name?.[0] || "?"}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--color-ink)]">
                                {reply.user_name}
                              </span>
                              <span className="text-[10px] text-[var(--color-ash)]">
                                {timeAgo(reply.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--color-body)] mt-0.5 break-words">
                              {reply.content}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <button
                                onClick={() => handleLike(reply.id)}
                                className={`text-[10px] transition-colors flex items-center gap-0.5 ${
                                  likedComments.has(reply.id)
                                    ? "text-[var(--color-primary)]"
                                    : "text-[var(--color-mute)] hover:text-[var(--color-primary)]"
                                }`}
                              >
                                <ThumbsUp className="w-2.5 h-2.5" />
                                {(reply.like_count || 0) > 0 && reply.like_count}
                              </button>
                              {reply.user_id === currentUserId && (
                                <button
                                  onClick={() => handleDelete(reply.id)}
                                  className="text-[10px] text-[var(--color-mute)] hover:text-red-500 transition-colors"
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <div className="border-t border-[var(--color-hairline)] px-5 py-3">
            {replyTo && (
              <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-[var(--color-surface-card)] rounded-lg">
                <span className="text-xs text-[var(--color-mute)]">
                  回复 <span className="text-[var(--color-ink)] font-medium">{replyTo.user_name}</span>
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  status === "authenticated" ? "写下你的评论..." : "登录后即可评论"
                }
                disabled={status !== "authenticated"}
                className="flex-1 h-10 px-4 rounded-full bg-[var(--color-surface-card)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ash)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 transition-all"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !newComment.trim() || status !== "authenticated"}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-primary)] text-white dark:bg-white dark:text-black hover:bg-[var(--color-primary-pressed,#c5001d)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}