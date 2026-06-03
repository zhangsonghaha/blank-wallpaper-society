"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<string, string> = {
  weekly_digest: "每周精选",
  activity_notice: "活动通知",
  creator_update: "创作者动态",
};

export default function UnsubscribeClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const type = searchParams.get("type") || "";

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState("");

  const handleUnsubscribe = async (unsubscribeAll: boolean) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/email-marketing/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type: unsubscribeAll ? undefined : type, all: unsubscribeAll }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult("success");
        setMessage(data.message);
      } else {
        setResult("error");
        setMessage(data.error);
      }
    } catch {
      setResult("error");
      setMessage("操作失败，请稍后重试");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-soft)]">
        <div className="text-center p-8">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--color-ink)]">无效的退订链接</h1>
          <p className="text-[var(--color-mute)] mt-2">该链接可能已过期或无效</p>
        </div>
      </div>
    );
  }

  if (result === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-soft)]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--color-ink)]">退订成功</h1>
          <p className="text-[var(--color-mute)] mt-2">{message}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-soft)]">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md p-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <Mail className="w-12 h-12 text-[var(--color-primary)] mx-auto mb-3" />
            <h1 className="text-xl font-bold text-[var(--color-ink)]">邮件退订</h1>
            <p className="text-sm text-[var(--color-mute)] mt-2">选择你要退订的邮件类型</p>
          </div>

          {result === "error" && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">{message}</div>
          )}

          <div className="space-y-3">
            {type && TYPE_LABELS[type] && (
              <Button
                variant="outline"
                className="w-full rounded-xl h-12 justify-start gap-3"
                onClick={() => handleUnsubscribe(false)}
                disabled={loading}
              >
                <XCircle className="w-4 h-4 text-red-400" />
                退订「{TYPE_LABELS[type]}」
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full rounded-xl h-12 justify-start gap-3 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => handleUnsubscribe(true)}
              disabled={loading}
            >
              <XCircle className="w-4 h-4" />
              退订所有邮件
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}