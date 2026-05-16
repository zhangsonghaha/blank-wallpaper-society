import type { Metadata } from "next";
import { Camera, Users, Globe, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "关于我们",
  description: "了解 ImageGallery 的故事、使命和团队。我们致力于打造最优质的视觉灵感平台。",
};

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative py-20 px-4 lg:px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-6">
            关于 ImageGallery
          </h1>
          <p className="text-lg text-[var(--color-mute)] leading-relaxed">
            我们是一群热爱视觉艺术的人，致力于为全球用户打造一个发现、分享和保存视觉灵感的最佳平台。
            从自然风光到城市建筑，从美食到艺术，我们相信每一张图片都能激发无限可能。
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 px-4 lg:px-8 bg-[var(--color-surface-card)]">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">
                精选内容
              </h3>
              <p className="text-sm text-[var(--color-mute)]">
                每一张壁纸都经过精心筛选，确保为用户提供最高品质的视觉体验
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">
                社区驱动
              </h3>
              <p className="text-sm text-[var(--color-mute)]">
                由全球摄影师、设计师和创意爱好者共同打造的内容社区
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
                <Globe className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">
                全球覆盖
              </h3>
              <p className="text-sm text-[var(--color-mute)]">
                支持多种语言，服务全球用户，让灵感无国界
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-ink)] mb-2">
                持续创新
              </h3>
              <p className="text-sm text-[var(--color-mute)]">
                运用 AI 技术和先进算法，不断优化用户体验和内容推荐
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-3xl font-bold text-[var(--color-ink)] mb-8 text-center">
            我们的故事
          </h2>
          <div className="space-y-6 text-[var(--color-body)] leading-relaxed">
            <p>
              ImageGallery 诞生于 2024 年，创始团队是一群对视觉设计和摄影充满热情的开发者。
              我们注意到，虽然互联网上充斥着海量图片，但要找到真正高质量、有灵感的视觉内容仍然非常困难。
            </p>
            <p>
              于是，我们决定创建一个平台，不仅聚合全球最优秀的壁纸和摄影作品，
              更通过智能推荐和社区互动，帮助用户发现那些能真正触动心灵的视觉内容。
            </p>
            <p>
              今天，ImageGallery 已经成长为拥有数百万用户的视觉灵感社区，
              每天有数万名创作者在这里分享作品，数百万用户在这里寻找灵感。
              但我们始终不忘初心——让每一张图片都能激发创造力。
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 lg:px-8 bg-[var(--color-surface-card)]">
        <div className="max-w-[1440px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-2">
                100万+
              </div>
              <div className="text-sm text-[var(--color-mute)]">优质壁纸</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-2">
                50万+
              </div>
              <div className="text-sm text-[var(--color-mute)]">活跃用户</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-2">
                200+
              </div>
              <div className="text-sm text-[var(--color-mute)]">国家/地区</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-2">
                10万+
              </div>
              <div className="text-sm text-[var(--color-mute)]">日下载量</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-3xl font-bold text-[var(--color-ink)] mb-4">
            加入我们
          </h2>
          <p className="text-[var(--color-mute)] mb-8">
            无论你是摄影师、设计师还是创意爱好者，ImageGallery 都欢迎你的加入。
            让我们一起打造更好的视觉社区。
          </p>
        </div>
      </section>
    </div>
  );
}