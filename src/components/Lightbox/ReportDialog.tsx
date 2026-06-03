"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Flag } from "lucide-react";
import { REPORT_CATEGORIES } from "./types";

interface ReportDialogProps {
  reportOpen: boolean;
  setReportOpen: (v: boolean) => void;
  reportCategory: string;
  setReportCategory: (v: string) => void;
  reportReason: string;
  setReportReason: (v: string) => void;
  submitting: boolean;
  handleReport: () => void;
}

export default function ReportDialog({
  reportOpen,
  setReportOpen,
  reportCategory,
  setReportCategory,
  reportReason,
  setReportReason,
  submitting,
  handleReport,
}: ReportDialogProps) {
  return (
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

            <div className="px-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-ink)] mb-2 block">举报分类 *</label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_CATEGORIES.map((cat) => (
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

            <div className="px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => { setReportOpen(false); setReportReason(""); setReportCategory(""); }}
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
  );
}
