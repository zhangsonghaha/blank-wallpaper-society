import type { Metadata } from "next";
import dynamic from "next/dynamic";

const PricingClient = dynamic(() => import("./PricingClient"), {
  loading: () => (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-48 h-8 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="w-72 h-4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "会员定价",
  description: "选择适合你的会员方案，解锁更多高清壁纸和专属功能。",
  openGraph: {
    title: "ImageGallery 会员定价",
    description: "选择适合你的会员方案，解锁更多高清壁纸和专属功能。",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}