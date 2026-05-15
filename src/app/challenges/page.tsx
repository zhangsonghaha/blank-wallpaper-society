import type { Metadata } from "next";
import ChallengesClient from "./ChallengesClient";

export const metadata: Metadata = {
  title: "挑战赛",
  description: "参加壁纸挑战赛，展示你的创作才华，赢取经验值奖励！",
};

export default function ChallengesPage() {
  return <ChallengesClient />;
}