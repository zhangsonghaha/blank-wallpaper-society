import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SearchProvider } from "@/context/SearchContext";
import AuthProvider from "@/components/AuthProvider";
import { ThemeProvider } from "next-themes";
import OnboardingGuide from "@/components/OnboardingGuide";
import CookieConsent from "@/components/CookieConsent";
import AnnouncementBar from "@/components/AnnouncementBar";
import FeedbackButton from "@/components/FeedbackButton";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ImageGallery | 发现视觉灵感",
    template: "%s | ImageGallery",
  },
  description:
    "探索精选摄影作品，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感。",
  keywords: ["图片", "摄影", "画廊", "灵感", "设计", "壁纸", "高清壁纸", "桌面壁纸", "手机壁纸"],
  authors: [{ name: "ImageGallery" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: "ImageGallery",
    title: "ImageGallery | 发现视觉灵感",
    description:
      "探索精选摄影作品，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感。",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImageGallery | 发现视觉灵感",
    description:
      "探索精选摄影作品，从自然风光到城市建筑，从美食到艺术，找到属于你的视觉灵感。",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <html lang="zh-CN" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SearchProvider>
            <AuthProvider session={session}>
              <Navbar />
              <div className="flex-1 pt-16 min-h-0">
                <AnnouncementBar />
                {children}
              </div>
              <Footer />
              <OnboardingGuide />
              <CookieConsent />
              <FeedbackButton />
              <Toaster position="top-right" richColors closeButton />
            </AuthProvider>
          </SearchProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}