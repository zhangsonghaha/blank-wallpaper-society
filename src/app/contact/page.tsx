import type { Metadata } from "next";
import { Mail, MessageCircle, Clock, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "联系我们",
  description: "联系 ImageGallery 团队，我们期待收到你的反馈和建议。",
};

export default function ContactPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-6">
            联系我们
          </h1>
          <p className="text-lg text-[var(--color-mute)] leading-relaxed">
            有任何问题、建议或合作意向？欢迎随时与我们联系，我们会在 24 小时内回复。
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-8 px-4 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-2xl border border-[var(--color-hairline)] p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-card)] flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <h3 className="font-bold text-[var(--color-ink)] mb-1">邮箱</h3>
              <p className="text-sm text-[var(--color-mute)]">
                support@imagegallery.app
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--color-hairline)] p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-card)] flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <h3 className="font-bold text-[var(--color-ink)] mb-1">
                工作时间
              </h3>
              <p className="text-sm text-[var(--color-mute)]">
                周一至周五 9:00 - 18:00
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--color-hairline)] p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-card)] flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <h3 className="font-bold text-[var(--color-ink)] mb-1">地址</h3>
              <p className="text-sm text-[var(--color-mute)]">
                中国 · 上海
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-20 px-4 lg:px-8">
        <div className="max-w-[700px] mx-auto">
          <div className="bg-white rounded-2xl border border-[var(--color-hairline)] p-8">
            <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6 text-center">
              发送消息
            </h2>
            <form className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    姓名
                  </label>
                  <input
                    type="text"
                    placeholder="你的名字"
                    className="w-full h-12 px-4 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-outer)] transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                    邮箱
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="w-full h-12 px-4 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-outer)] transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  主题
                </label>
                <select className="w-full h-12 px-4 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-outer)] transition-all appearance-none">
                  <option value="">选择主题</option>
                  <option value="general">一般咨询</option>
                  <option value="support">技术支持</option>
                  <option value="business">商务合作</option>
                  <option value="feedback">意见反馈</option>
                  <option value="report">内容举报</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  消息内容
                </label>
                <textarea
                  rows={6}
                  placeholder="请详细描述你的问题或建议..."
                  className="w-full px-4 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-outer)] transition-all resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-[var(--color-primary)] text-white font-semibold rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors"
              >
                发送消息
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="py-16 px-4 lg:px-8 bg-[var(--color-surface-card)]">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4">
            我们也倾听社区的声音
          </h2>
          <p className="text-[var(--color-mute)] leading-relaxed">
            除了直接联系我们，你也可以在 GitHub 上提交 Issue 或参与讨论。
            我们非常重视每一位用户的反馈，你的建议将帮助我们做得更好。
          </p>
        </div>
      </section>
    </div>
  );
}