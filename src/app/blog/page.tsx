import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "博客",
  description: "探索 ImageGallery 的最新动态、使用技巧、创作者故事和行业洞察。",
};

const blogPosts = [
  {
    id: 1,
    title: "如何拍摄令人惊叹的桌面壁纸",
    excerpt:
      "从构图到光线，学习专业摄影师的技巧，拍出令人惊艳的桌面壁纸作品。",
    date: "2026-05-10",
    readTime: "8 分钟",
    category: "教程",
  },
  {
    id: 2,
    title: "2026 年壁纸设计趋势预测",
    excerpt:
      "从极简主义到 AI 生成艺术，探索今年最流行的壁纸设计风格和趋势。",
    date: "2026-04-28",
    readTime: "6 分钟",
    category: "趋势",
  },
  {
    id: 3,
    title: "ImageGallery 社区月报：四月精选",
    excerpt:
      "回顾四月份社区最受欢迎的作品和创作者，发现新的视觉灵感。",
    date: "2026-04-15",
    readTime: "5 分钟",
    category: "社区",
  },
  {
    id: 4,
    title: "AI 生成壁纸：创意的新边界",
    excerpt:
      "了解如何利用 AI 工具创作独特的壁纸，以及它对创意行业的影响。",
    date: "2026-04-02",
    readTime: "10 分钟",
    category: "技术",
  },
  {
    id: 5,
    title: "自然风光摄影：捕捉四季之美",
    excerpt:
      "跟随我们的摄影师走进大自然，学习如何在不同季节拍摄壮观的风景。",
    date: "2026-03-20",
    readTime: "7 分钟",
    category: "教程",
  },
  {
    id: 6,
    title: "城市建筑壁纸的拍摄秘籍",
    excerpt:
      "探索城市建筑摄影的艺术，从摩天大楼到街头巷尾，发现城市之美。",
    date: "2026-03-08",
    readTime: "9 分钟",
    category: "教程",
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-6">
            ImageGallery 博客
          </h1>
          <p className="text-lg text-[var(--color-mute)] leading-relaxed">
            发现使用技巧、创作者故事、设计趋势和平台最新动态
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="pb-20 px-4 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogPosts.map((post) => (
              <article
                key={post.id}
                className="group bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-hairline)] overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-[var(--color-surface-card)] flex items-center justify-center">
                  <div className="text-6xl font-bold text-[var(--color-stone)]">
                    {post.title[0]}
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-2.5 py-1 bg-[var(--color-surface-card)] text-xs font-medium text-[var(--color-mute)] rounded-full">
                      {post.category}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-[var(--color-ash)]">
                      <Calendar className="w-3.5 h-3.5" />
                      {post.date}
                    </div>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--color-ink)] mb-2 line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-[var(--color-mute)] mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-[var(--color-ash)]">
                      <Clock className="w-3.5 h-3.5" />
                      {post.readTime}
                    </div>
                    <Link
                      href={`/blog/${post.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:gap-2 transition-all"
                    >
                      阅读更多
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 px-4 lg:px-8 bg-[var(--color-surface-card)]">
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4">
            订阅我们的更新
          </h2>
          <p className="text-[var(--color-mute)] mb-6">
            获取最新的壁纸推荐、创作者故事和独家教程，直接发送到你的邮箱。
          </p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input
              type="email"
              placeholder="输入你的邮箱"
              className="flex-1 h-12 px-4 bg-[var(--color-surface-card)] border border-[var(--color-hairline)] rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-outer)]"
            />
            <button className="px-6 h-12 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors shrink-0">
              订阅
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}