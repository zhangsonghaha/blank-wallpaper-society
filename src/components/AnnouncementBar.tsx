"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Info, AlertTriangle, X, ChevronRight } from "lucide-react";

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: "notice" | "announcement" | "maintenance";
  priority: "low" | "normal" | "high" | "urgent";
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  notice: <Info className="w-4 h-4 shrink-0" />,
  announcement: <Megaphone className="w-4 h-4 shrink-0" />,
  maintenance: <AlertTriangle className="w-4 h-4 shrink-0" />,
};

const typeColors: Record<string, string> = {
  notice: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
  announcement: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
  maintenance: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
};

const priorityBorders: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-orange-500",
  normal: "",
  low: "",
};

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.data || []);
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    // 每60秒轮询一次
    const interval = setInterval(fetchAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  // 自动轮播（每5秒）
  useEffect(() => {
    const visible = announcements.filter(a => !dismissed.has(a.id));
    if (visible.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        const nextVisible = announcements.filter(a => !dismissed.has(a.id));
        if (nextVisible.length === 0) return 0;
        const currentVisibleIndex = nextVisible.findIndex(a => a.id === announcements[prev]?.id);
        const nextIndex = (currentVisibleIndex + 1) % nextVisible.length;
        return announcements.findIndex(a => a.id === nextVisible[nextIndex]?.id);
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [announcements, dismissed]);

  // 从 sessionStorage 恢复已关闭的公告
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem("dismissed_announcements") || "[]");
      if (stored.length > 0) {
        setDismissed(new Set(stored));
      }
    } catch {}
  }, []);

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));
  const currentAnnouncement = visibleAnnouncements.length > 0
    ? visibleAnnouncements.find(a => a.id === announcements[currentIndex]?.id) || visibleAnnouncements[0]
    : null;

  if (!currentAnnouncement) return null;

  const handleDismiss = (id: number) => {
    setDismissed(prev => new Set(prev).add(id));
    // 存入 sessionStorage，刷新后恢复
    try {
      const stored = JSON.parse(sessionStorage.getItem("dismissed_announcements") || "[]");
      sessionStorage.setItem("dismissed_announcements", JSON.stringify([...stored, id]));
    } catch {}
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentAnnouncement.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className={`mx-4 mt-2 rounded-lg border ${typeColors[currentAnnouncement.type] || typeColors.announcement} ${priorityBorders[currentAnnouncement.priority] || ""}`}
      >
        <div className="flex items-center gap-2 px-4 py-2.5">
          {/* 图标 */}
          <div className="shrink-0">
            {typeIcons[currentAnnouncement.type] || typeIcons.announcement}
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">
                {currentAnnouncement.title}
              </span>
              {visibleAnnouncements.length > 1 && (
                <span className="text-xs opacity-60 shrink-0">
                  {visibleAnnouncements.findIndex(a => a.id === currentAnnouncement.id) + 1}/{visibleAnnouncements.length}
                </span>
              )}
            </div>
            {expanded && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-sm mt-1 whitespace-pre-wrap opacity-80"
              >
                {currentAnnouncement.content}
              </motion.p>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              title={expanded ? "收起" : "展开"}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
            </button>
            <button
              onClick={() => handleDismiss(currentAnnouncement.id)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              title="关闭"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}