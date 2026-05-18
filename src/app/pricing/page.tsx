import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "会员定价",
  description: "选择适合你的会员方案，解锁更多高清壁纸和专属功能。",
  openGraph: {
    title: "ImageGallery 会员定价",
    description: "选择适合你的会员方案，解锁更多高清壁纸和专属功能。",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}