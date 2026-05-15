import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "排行榜",
  description: "查看最受欢迎的壁纸排行榜，按日榜、周榜、月榜浏览热门作品。",
  openGraph: {
    title: "排行榜 | ImageGallery",
    description: "查看最受欢迎的壁纸排行榜，按日榜、周榜、月榜浏览热门作品。",
  },
};

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}