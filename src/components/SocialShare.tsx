"use client";

import { useState, useCallback } from "react";
import {
  X, Link2, Check, MessageCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SocialShareProps {
  imageId: number;
  imageTitle: string;
  imageUrl?: string;
  isOpen: boolean;
  onClose: () => void;
}

function buildShareUrl(origin: string, imageId: number, source: string): string {
  const base = `${origin}/images/${imageId}`;
  return `${base}?utm_source=${source}&utm_medium=share&utm_campaign=social_share`;
}

// 图标组件（提取到模块级别，引用稳定）
function WeiboIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M10.09 17.68c-3.19.31-5.94-1.13-6.15-3.21-.21-2.08 2.21-4.03 5.4-4.34 3.19-.31 5.94 1.13 6.15 3.21.21 2.08-2.21 4.03-5.4 4.34zm7.54-9.63c-.26-.08-.44-.14-.3-.5.29-.78.32-1.45.01-1.93-.59-.89-2.21-.84-4.06-.03 0 0-.58.27-.43-.22.28-.95.24-1.75-.21-2.21-1.06-1.1-3.89.04-6.32 2.55C4.06 7.62 3 10.17 3 12.39c0 4.27 5.47 6.87 10.82 6.87 7.02 0 11.7-4.08 11.7-7.32 0-1.96-1.65-3.07-3.09-3.53l-.8-.36zm2.5-3.54c-.88-1.03-2.18-1.42-3.38-1.15l-.06.01c-.28.07-.45.35-.38.63.07.28.35.45.63.38.83-.19 1.74.06 2.37.79.63.74.78 1.72.48 2.57l-.02.06c-.09.27.06.56.33.65.27.09.56-.06.65-.33l.02-.06c.42-1.2.22-2.56-.64-3.55z"/>
    </svg>
  );
}

function QQIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3v1c0 1.66-1.34 3-3 3s-3-1.34-3-3V8c0-1.66 1.34-3 3-3zm0 14c-2.5 0-4.73-1.14-6.22-2.92C6.63 14.77 8.62 14 12 14s5.37.77 6.22 2.08C16.73 17.86 14.5 19 12 19z"/>
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export default function SocialShare({
  imageId,
  imageTitle,
  imageUrl,
  isOpen,
  onClose,
}: SocialShareProps) {
  return <SocialShareContent
    imageId={imageId}
    imageTitle={imageTitle}
    imageUrl={imageUrl}
    isOpen={isOpen}
    onClose={onClose}
  />;
}

function SocialShareContent({
  imageId,
  imageTitle,
  imageUrl,
  isOpen,
  onClose,
}: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copyLink = useCallback(async () => {
    const url = buildShareUrl(origin, imageId, "copy_link");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("链接已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [origin, imageId]);

  const shareToWeibo = useCallback(() => {
    const url = buildShareUrl(origin, imageId, "weibo");
    const text = `分享一张精美壁纸：${imageTitle}`;
    const pic = imageUrl || "";
    const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}&pic=${encodeURIComponent(pic)}`;
    window.open(weiboUrl, "_blank", "width=600,height=500");
  }, [origin, imageId, imageTitle, imageUrl]);

  const shareToWeChat = useCallback(() => {
    const url = buildShareUrl(origin, imageId, "wechat");
    navigator.clipboard.writeText(url).then(() => {
      toast.success("链接已复制，可粘贴到微信分享");
    }).catch(() => {
      toast.error("复制失败");
    });
  }, [origin, imageId]);

  const shareToQQ = useCallback(() => {
    const url = buildShareUrl(origin, imageId, "qq");
    const title = `${imageTitle} - 精选壁纸`;
    const desc = `发现一张精美壁纸：${imageTitle}，快来看看吧！`;
    const pic = imageUrl || "";
    const qqUrl = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}&pics=${encodeURIComponent(pic)}`;
    window.open(qqUrl, "_blank", "width=600,height=500");
  }, [origin, imageId, imageTitle, imageUrl]);

  const shareToTwitter = useCallback(() => {
    const url = buildShareUrl(origin, imageId, "twitter");
    const text = `Check out this amazing wallpaper: ${imageTitle}`;
    const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "width=600,height=500");
  }, [origin, imageId, imageTitle]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-soft)] rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-sm w-full mx-0 sm:mx-4 overflow-hidden animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-hairline)]">
          <h3 className="text-base font-semibold text-[var(--color-ink)]">分享到</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--color-mute)]" />
          </button>
        </div>

        {/* 分享平台 */}
        <div className="p-5">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {/* 微信 */}
            <button onClick={shareToWeChat} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-[var(--color-surface-card)] transition-colors">
              <div className="w-11 h-11 rounded-full bg-green-50 dark:bg-green-900/10 flex items-center justify-center text-green-500">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-[var(--color-mute)]">微信</span>
            </button>
            {/* 微博 */}
            <button onClick={shareToWeibo} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-[var(--color-surface-card)] transition-colors">
              <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500">
                <WeiboIcon />
              </div>
              <span className="text-[11px] text-[var(--color-mute)]">微博</span>
            </button>
            {/* QQ */}
            <button onClick={shareToQQ} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-[var(--color-surface-card)] transition-colors">
              <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-500">
                <QQIcon />
              </div>
              <span className="text-[11px] text-[var(--color-mute)]">QQ</span>
            </button>
            {/* Twitter */}
            <button onClick={shareToTwitter} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-[var(--color-surface-card)] transition-colors">
              <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-800 dark:text-gray-200">
                <TwitterIcon />
              </div>
              <span className="text-[11px] text-[var(--color-mute)]">X</span>
            </button>
            {/* 复制链接 */}
            <button onClick={copyLink} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-[var(--color-surface-card)] transition-colors">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${copied ? "bg-green-50 dark:bg-green-900/10 text-green-500" : "bg-[var(--color-surface-card)] text-[var(--color-ink)]"}`}>
                {copied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
              </div>
              <span className="text-[11px] text-[var(--color-mute)]">{copied ? "已复制" : "复制链接"}</span>
            </button>
          </div>
        </div>

        {/* 关闭 */}
        <div className="px-5 pb-5">
          <Button variant="ghost" className="w-full rounded-full" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}