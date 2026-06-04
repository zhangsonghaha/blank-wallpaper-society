import { Metadata } from "next";
import dynamic from "next/dynamic";

const MessagesClient = dynamic(() => import("./MessagesClient"), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="animate-pulse flex gap-4">
        <div className="w-72 h-[60vh] rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 h-[60vh] rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "私信 - Blank Wallpaper Society",
  description: "与其他用户进行私密对话",
};

export default function MessagesPage() {
  return <MessagesClient />;
}