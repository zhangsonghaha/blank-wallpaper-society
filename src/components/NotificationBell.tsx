"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, X, Settings } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { withCsrfHeader } from "@/lib/csrf-client";

interface Notification {
  id: number;
  type: string;
  title: string;
  content: string | null;
  related_id: number | null;
  related_type: string | null;
  is_read: number;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  system: "🔔",
  like: "❤️",
  comment: "💬",
  review: "✅",
  follow: "👤",
  achievement: "🏆",
  favorite: "⭐",
  message: "📩",
  order: "💰",
};

const typeLabels: Record<string, string> = {
  system: "系统",
  like: "点赞",
  comment: "评论",
  review: "审核",
  follow: "关注",
  achievement: "成就",
  favorite: "收藏",
  message: "私信",
  order: "订单",
};

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

export default function NotificationBell() {
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // 获取通知
  const fetchNotifications = async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // 静默失败
    }
  };

  // 轮询未读数
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [status]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // 标记单条已读
  const markAsRead = async (id: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/notifications/${id}`, { method: "PATCH", headers: { ...csrfHeaders } });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // 静默失败
    }
  };

  // 全部标记已读
  const markAllAsRead = async () => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch {
      // 静默失败
    }
  };

  // 删除通知
  const deleteNotification = async (id: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE", headers: { ...csrfHeaders } });
      if (res.ok) {
        const deleted = notifications.find((n) => n.id === id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        if (deleted && !deleted.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch {
      // 静默失败
    }
  };

  if (status !== "authenticated") return null;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
      >
        <Bell className="w-5 h-5 text-[var(--color-ink)]" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-[var(--color-primary)] dark:bg-white text-white dark:text-black text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-hairline)] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline)]">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                通知
                {unreadCount > 0 && (
                  <span className="ml-1.5 text-xs text-[var(--color-primary)]">
                    ({unreadCount}条未读)
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-full hover:bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                    title="全部标记已读"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <Link
                  href="/profile?tab=settings"
                  className="p-1.5 rounded-full hover:bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                  title="通知设置"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--color-mute)]">
                  <Bell className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">暂无通知</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group relative px-4 py-3 border-b border-[var(--color-hairline)] last:border-b-0 transition-colors ${
                      !notification.is_read
                        ? "bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10"
                        : "hover:bg-[var(--color-surface-card)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <span className="text-lg mt-0.5 flex-shrink-0">
                        {typeIcons[notification.type] || "🔔"}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-surface-card)] text-[var(--color-mute)] font-medium">
                            {typeLabels[notification.type] || "系统"}
                          </span>
                          {!notification.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-[var(--color-ink)] mt-1 truncate">
                          {notification.title}
                        </p>
                        {notification.content && (
                          <p className="text-xs text-[var(--color-mute)] mt-0.5 line-clamp-2">
                            {notification.content}
                          </p>
                        )}
                        <p className="text-[10px] text-[var(--color-ash)] mt-1">
                          {timeAgo(notification.created_at)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 rounded-full hover:bg-[var(--color-surface-card)] text-[var(--color-mute)]"
                            title="标记已读"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-mute)] hover:text-red-500"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}