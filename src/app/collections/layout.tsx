import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "合集",
  description: "浏览精选壁纸合集，发现按主题精选的高质量壁纸系列。",
  openGraph: {
    title: "壁纸合集 | ImageGallery",
    description: "浏览精选壁纸合集，发现按主题精选的高质量壁纸系列。",
  },
};

export default function CollectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}