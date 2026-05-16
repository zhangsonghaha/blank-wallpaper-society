"use client";

import { useRef, useEffect, useState, useCallback } from "react";

/**
 * 中文翻译字符串（altcha-widget v3 的 Strings 接口）
 */
const ZH_CN_STRINGS = {
  ariaLinkLabel: "Altcha 官方网站",
  enterCode: "输入验证码",
  enterCodeAria: "输入听到的验证码，按空格键播放音频",
  enterCodeFromImage: "请输入下方图片中的验证码以继续",
  error: "验证失败，请稍后重试",
  expired: "验证已过期，请重试",
  footer: '由 <a href="https://altcha.org/" tabindex="-1" target="_blank" aria-label="Altcha 官方网站">ALTCHA</a> 保护',
  getAudioChallenge: "获取音频验证码",
  label: "我不是机器人",
  loading: "加载中...",
  reload: "刷新",
  verify: "验证",
  verificationRequired: "请完成人机验证！",
  verified: "验证通过",
  verifying: "验证中...",
  waitAlert: "验证中，请稍候...",
};

interface AltchaWidgetProps {
  /** Challenge 接口 URL */
  challengeUrl?: string;
  /** 隐藏输入字段的 name 属性 */
  name?: string;
  /** 验证状态变化回调 */
  onVerifiedChange?: (verified: boolean) => void;
  /** 获取 payload 值的回调 */
  onPayloadChange?: (payload: string | null) => void;
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 可复用的中文 Altcha 人机验证组件
 *
 * 适配 altcha v3 widget，自动注册中文翻译。
 * 使用 `language="cn"` 属性 + 全局 i18n 注册实现中文显示。
 */
export default function AltchaWidget({
  challengeUrl = "/api/auth/altcha-challenge",
  name = "altchaPayload",
  onVerifiedChange,
  onPayloadChange,
  className,
}: AltchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [verified, setVerified] = useState(false);
  const widgetRef = useRef<any>(null);

  // 创建和配置 altcha-widget
  useEffect(() => {
    if (!containerRef.current) return;
    // 避免重复创建
    if (containerRef.current.querySelector("altcha-widget")) return;

    // 先注册中文 i18n（在创建 widget 之前）
    const registerI18n = () => {
      if (typeof window !== "undefined" && (globalThis as any).$altcha) {
        const altcha = (globalThis as any).$altcha;
        if (!altcha.i18n.get("cn")) {
          altcha.i18n.set("cn", ZH_CN_STRINGS);
        }
        return true;
      }
      return false;
    };

    // 尝试立即注册，如果 $altcha 还未就绪则等待
    if (!registerI18n()) {
      // 使用 MutationObserver 或轮询等待 $altcha 就绪
      const checkInterval = setInterval(() => {
        if (registerI18n()) {
          clearInterval(checkInterval);
        }
      }, 100);
      // 5秒超时
      setTimeout(() => clearInterval(checkInterval), 5000);
    }

    const widget = document.createElement("altcha-widget");

    // challenge 属性用于指定挑战接口 URL（altcha-widget v3/v2 统一使用此属性）
    widget.setAttribute("challenge", challengeUrl);
    widget.setAttribute("name", name);
    widget.setAttribute("language", "cn");
    widget.setAttribute("auto", "onload");

    // 通过 configuration JSON 传递高级设置
    widget.setAttribute(
      "configuration",
      JSON.stringify({
        hideFooter: true,
        hideLogo: true,
        display: "standard",
        minDuration: 500,
      })
    );

    // 监听状态变化
    widget.addEventListener(
      "statechange",
      ((e: CustomEvent) => {
        const state = e.detail?.state;
        const newVerified = state === "verified";
        setVerified(newVerified);
        onVerifiedChange?.(newVerified);

        // 非 verified 状态清除 payload
        if (!newVerified) {
          onPayloadChange?.(null);
        }
      }) as EventListener
    );

    // 监听 verified 事件获取 payload（官方推荐方式）
    widget.addEventListener(
      "verified",
      ((e: CustomEvent) => {
        const payload = e.detail?.payload || null;
        onPayloadChange?.(payload);
      }) as EventListener
    );

    widgetRef.current = widget;
    containerRef.current.appendChild(widget);

    return () => {
      // 清理
      if (containerRef.current && widget.parentNode === containerRef.current) {
        containerRef.current.removeChild(widget);
      }
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`altcha-container ${className || ""}`}
      data-verified={verified}
    />
  );
}

export { ZH_CN_STRINGS };