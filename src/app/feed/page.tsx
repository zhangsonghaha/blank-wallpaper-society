import type { Metadata } from "next";
import FeedClient from "./FeedClient";

export const metadata: Metadata = {
  title: "动态",
  description: "浏览关注者、推荐和热门壁纸的混合动态",
};

export default function FeedPage() {
  return <FeedClient />;
}