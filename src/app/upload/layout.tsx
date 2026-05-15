import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "上传壁纸",
  description: "上传您的壁纸作品，与社区分享高质量图片。",
  openGraph: {
    title: "上传壁纸 | ImageGallery",
    description: "上传您的壁纸作品，与社区分享高质量图片。",
  },
};

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}