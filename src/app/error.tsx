"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("页面错误:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-20 h-20 mb-6 rounded-full bg-red-50 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">
        页面出了点问题
      </h2>
      <p className="text-sm text-[var(--color-mute)] mb-6 max-w-md text-center">
        抱歉，页面加载时发生了错误。请尝试刷新页面，如果问题持续存在，请联系管理员。
      </p>
      <Button onClick={reset} className="rounded-full px-6">
        重试
      </Button>
    </div>
  );
}