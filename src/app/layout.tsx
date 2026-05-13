import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SearchProvider } from "@/context/SearchContext";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ImageGallery | 发现视觉灵感",
  description:
    "探索精选摄影作品，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感。",
  keywords: ["图片", "摄影", "画廊", "灵感", "设计"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <SearchProvider>
          <AuthProvider>
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </AuthProvider>
        </SearchProvider>
      </body>
    </html>
  );
}