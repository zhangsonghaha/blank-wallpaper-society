import { Suspense } from "react";
import dynamic from "next/dynamic";

const UnsubscribeClient = dynamic(() => import("./UnsubscribeClient"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-pulse w-64 h-8 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  ),
});

export default function UnsubscribePage() {
  return <Suspense><UnsubscribeClient /></Suspense>;
}