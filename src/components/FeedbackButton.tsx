"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bug, Lightbulb, Wrench, HelpCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";

const CATEGORIES = [
  { id: "bug", label: "Bug 反馈", icon: Bug, color: "text-red-500" },
  { id: "feature", label: "功能建议", icon: Lightbulb, color: "text-yellow-500" },
  { id: "improvement", label: "体验优化", icon: Wrench, color: "text-blue-500" },
  { id: "other", label: "其他", icon: HelpCircle, color: "text-gray-500" },
];

export default function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("other");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || content.trim().length < 5) {
      toast.error("请输入至少5个字的反馈内容");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({
          content: content.trim(),
          category,
          pageUrl: window.location.href,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        toast.success("感谢你的反馈！");
        setTimeout(() => {
          setIsOpen(false);
          setContent("");
          setCategory("other");
          setSubmitted(false);
        }, 2000);
      } else {
        const data = await res.json();
        toast.error(data.error || "提交失败");
      }
    } catch {
      toast.error("提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[var(--color-primary)] text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="反馈"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-6 z-50 w-80 bg-[var(--color-surface-soft)] rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden"
          >
            {submitted ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-medium text-[var(--color-ink)] mb-1">感谢反馈！</h3>
                <p className="text-sm text-[var(--color-mute)]">我们会认真对待每一条反馈</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <h3 className="font-medium text-[var(--color-ink)]">意见反馈</h3>
                  <p className="text-xs text-[var(--color-mute)]">遇到问题或有建议？告诉我们</p>
                </div>
                <div className="px-4 py-3 flex gap-2 flex-wrap">
                  {CATEGORIES.map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition-colors ${
                          category === cat.id
                            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                            : "bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                        }`}
                      >
                        <CatIcon className={`w-3 h-3 ${category === cat.id ? cat.color : ""}`} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
                <div className="px-4 pb-3">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="请描述你的反馈..."
                    className="w-full h-24 px-3 py-2 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-border)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-mute)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                    maxLength={2000}
                  />
                  <p className="text-xs text-[var(--color-mute)] mt-1 text-right">
                    {content.length}/2000
                  </p>
                </div>
                <div className="px-4 pb-4">
                  <Button
                    className="w-full rounded-full gap-1"
                    onClick={handleSubmit}
                    disabled={submitting || content.trim().length < 5}
                  >
                    {submitting ? "提交中..." : <><Send className="w-4 h-4" />提交反馈</>}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}