import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ChallengesClient = dynamic(() => import("./ChallengesClient"), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-48 h-6 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: "挑战赛",
  description: "参加壁纸挑战赛，展示你的创作才华，赢取经验值奖励！",
};

export default function ChallengesPage() {
  return <ChallengesClient />;
}