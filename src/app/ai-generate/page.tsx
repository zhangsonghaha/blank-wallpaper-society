import type { Metadata } from "next";
import dynamic from "next/dynamic";

const AiGenerateClient = dynamic(() => import("./AiGenerateClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-full h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "AI壁纸生成",
  description: "使用AI生成独一无二的壁纸，支持多种风格选择。",
};

export default function AiGeneratePage() {
  return <AiGenerateClient />;
}