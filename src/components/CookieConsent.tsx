"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "cookie_consent";

type ConsentLevel = "none" | "necessary" | "all";

interface ConsentState {
  level: ConsentLevel;
  timestamp: string;
}

export function getCookieConsent(): ConsentLevel {
  if (typeof window === "undefined") return "none";
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return "none";
    const state: ConsentState = JSON.parse(raw);
    return state.level;
  } catch {
    return "none";
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (consent === "none") {
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (level: ConsentLevel) => {
    const state: ConsentState = {
      level,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(state));
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <div className="max-w-3xl mx-auto bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-2xl shadow-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-50 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-1">
                  Cookie 使用说明
                </h3>
                <p className="text-xs text-[var(--color-mute)] leading-relaxed mb-3">
                  我们使用 Cookie 来提升您的浏览体验、分析网站流量和提供个性化内容。必要的 Cookie 确保网站正常运行，分析型 Cookie 帮助我们了解使用情况。
                </p>

                {showDetails && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked disabled className="rounded" />
                      <span className="text-xs text-[var(--color-ink)]">必要 Cookie（网站运行必需）</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked className="rounded accent-[var(--color-primary)]" readOnly />
                      <span className="text-xs text-[var(--color-ink)]">分析型 Cookie（帮助我们改进服务）</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" className="rounded-full text-xs" onClick={() => saveConsent("all")}>
                    全部接受
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => saveConsent("necessary")}>
                    仅必要
                  </Button>
                  <button
                    className="text-xs text-[var(--color-ash)] hover:text-[var(--color-ink)] underline"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? "收起" : "详细设置"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => saveConsent("necessary")}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)]"
              >
                <X className="w-3.5 h-3.5 text-[var(--color-ash)]" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}