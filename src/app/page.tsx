import type { Metadata } from "next";
import MasonryGrid from "@/components/MasonryGrid";

export const metadata: Metadata = {
  title: "发现视觉灵感",
  description: "浏览精选高清壁纸，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感。",
  openGraph: {
    title: "ImageGallery | 发现视觉灵感",
    description: "浏览精选高清壁纸，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感。",
  },
};

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ImageGallery",
    description: "发现视觉灵感 - 精选高清壁纸平台",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://imagegallery.app",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${process.env.NEXT_PUBLIC_BASE_URL || "https://imagegallery.app"}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MasonryGrid />
    </>
  );
}