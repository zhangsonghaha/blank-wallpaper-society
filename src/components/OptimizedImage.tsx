"use client";

import Image, { ImageProps } from "next/image";
import { useState } from "react";

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
  /** 是否显示加载骨架 */
  showSkeleton?: boolean;
}

/**
 * 优化图片组件
 * - 使用 Next.js Image 组件实现自动优化
 * - 支持 blur placeholder
 * - 懒加载 + 加载状态
 * - 错误回退
 */
export default function OptimizedImage({
  src,
  alt,
  className,
  showSkeleton = true,
  ...props
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--color-surface-card)] ${className || ""}`}
        style={{ width: "100%", height: "100%" }}
      >
        <svg
          className="w-8 h-8 text-[var(--color-ash)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <>
      {showSkeleton && !loaded && (
        <div
          className={`absolute inset-0 bg-[var(--color-surface-card)] animate-pulse ${className || ""}`}
        />
      )}
      <Image
        src={src}
        alt={alt}
        className={`${className || ""} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        {...props}
      />
    </>
  );
}