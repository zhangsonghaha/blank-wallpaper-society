import { Metadata } from "next";
import dynamic from "next/dynamic";

const MembershipClient = dynamic(() => import("./MembershipClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "会员中心",
  description: "查看你的会员特权、额度使用和到期信息。",
};

export default function MembershipPage() {
  return <MembershipClient />;
}