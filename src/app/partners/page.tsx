import type { Metadata } from "next";
import Link from "next/link";
import { Handshake, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "合作伙伴",
  description: "了解 ImageGallery 的合作伙伴计划，与我们携手共建视觉生态。",
};

const partners = [
  {
    name: "Unsplash",
    description: "全球领先的免费高清图片平台，为创作者提供优质素材。",
    url: "https://unsplash.com",
  },
  {
    name: "Pexels",
    description: "免费高质量图片和视频资源库，助力创意表达。",
    url: "https://pexels.com",
  },
  {
    name: "Pixabay",
    description: "拥有数百万张免费图片、插画和视频的创作社区。",
    url: "https://pixabay.com",
  },
  {
    name: "Wallhaven",
    description: "专注于壁纸分享的专业社区，拥有海量优质壁纸资源。",
    url: "https://wallhaven.cc",
  },
  {
    name: "Adobe Stock",
    description: "专业级创意素材平台，提供高品质图片和设计资源。",
    url: "https://stock.adobe.com",
  },
  {
    name: "Getty Images",
    description: "全球领先的视觉内容提供商，拥有丰富的编辑和创意图片。",
    url: "https://gettyimages.com",
  },
];

export default function PartnersPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-6">
            <Handshake className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-6">
            合作伙伴
          </h1>
          <p className="text-lg text-[var(--color-mute)] leading-relaxed">
            ImageGallery 与全球领先的视觉内容平台和创作者社区合作，
            为用户提供更丰富、更高质量的视觉体验。
          </p>
        </div>
      </section>

      {/* Partners Grid */}
      <section className="pb-20 px-4 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <div
                key={partner.name}
                className="group bg-white rounded-2xl border border-[var(--color-hairline)] p-8 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-card)] flex items-center justify-center mb-4 text-2xl font-bold text-[var(--color-stone)]">
                  {partner.name[0]}
                </div>
                <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">
                  {partner.name}
                </h3>
                <p className="text-sm text-[var(--color-mute)] mb-4 leading-relaxed">
                  {partner.description}
                </p>
                <a
                  href={partner.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:gap-2 transition-all"
                >
                  访问网站
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become Partner Section */}
      <section className="py-20 px-4 lg:px-8 bg-[var(--color-surface-card)]">
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-3xl font-bold text-[var(--color-ink)] mb-4">
            成为合作伙伴
          </h2>
          <p className="text-[var(--color-mute)] mb-8 leading-relaxed">
            无论你是内容平台、技术供应商还是创作者社区，如果你希望与 ImageGallery 建立合作，
            欢迎联系我们。我们期待与志同道合的伙伴一起，为用户创造更好的体验。
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors"
          >
            联系我们
          </Link>
        </div>
      </section>
    </div>
  );
}