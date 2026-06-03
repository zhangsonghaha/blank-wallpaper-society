import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "常见问题",
  description: "查看 ImageGallery 的常见问题解答，快速解决你的疑问。",
};

const faqCategories = [
  {
    title: "账户相关",
    questions: [
      {
        q: "如何注册 ImageGallery 账户？",
        a: "点击页面右上角的「注册」按钮，填写邮箱和密码即可完成注册。你也可以使用 Google 或 GitHub 账号快速登录。",
      },
      {
        q: "忘记密码怎么办？",
        a: "在登录页面点击「忘记密码」，输入你的注册邮箱，我们会发送密码重置链接到你的邮箱。",
      },
      {
        q: "如何删除我的账户？",
        a: "请登录后进入个人设置页面，在「账户安全」选项中找到「删除账户」功能。请注意，删除账户后所有数据将无法恢复。",
      },
    ],
  },
  {
    title: "内容使用",
    questions: [
      {
        q: "网站上的壁纸可以免费下载吗？",
        a: "是的，平台上的大部分壁纸都可以免费下载使用。部分高品质付费壁纸需要购买会员或单独付费。",
      },
      {
        q: "下载的壁纸可以商用吗？",
        a: "免费壁纸仅供个人使用。如需商用，请查看图片详情页的授权信息或购买相应的商业授权。",
      },
      {
        q: "如何在不同设备上使用壁纸？",
        a: "下载壁纸后，你可以在手机、平板、电脑等设备上使用。我们还提供在线裁剪工具，帮助你调整图片尺寸适配不同屏幕。",
      },
    ],
  },
  {
    title: "上传与创作",
    questions: [
      {
        q: "我可以上传自己的作品吗？",
        a: "可以的！注册并登录后，点击导航栏的「上传」按钮即可分享你的作品。我们支持 JPG、PNG、WebP 等常见格式。",
      },
      {
        q: "上传图片有什么要求？",
        a: "单张图片不超过 20MB，建议分辨率不低于 1920x1080。请确保上传的内容不违反版权和平台社区规范。",
      },
      {
        q: "如何获得更多曝光？",
        a: "为图片添加准确的标题、描述和标签，参与挑战赛，与其他创作者互动，都能帮助你的作品获得更多关注。",
      },
    ],
  },
  {
    title: "技术支持",
    questions: [
      {
        q: "下载速度很慢怎么办？",
        a: "建议使用稳定的网络连接。如果问题持续，可以尝试清除浏览器缓存或更换浏览器。我们的服务器分布在全球多个节点，一般能够提供快速下载。",
      },
      {
        q: "图片显示异常怎么解决？",
        a: "请检查浏览器是否为最新版本，或尝试禁用浏览器扩展。如果问题仍然存在，请联系我们的技术支持团队。",
      },
      {
        q: "支持哪些浏览器？",
        a: "我们支持 Chrome、Firefox、Safari、Edge 等主流浏览器的最新两个版本。为了获得最佳体验，建议使用 Chrome 或 Safari。",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="py-20 px-4 lg:px-8">
        <div className="max-w-[800px] mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-6">
            常见问题
          </h1>
          <p className="text-lg text-[var(--color-mute)] leading-relaxed">
            快速找到你需要的答案，如果没有找到，欢迎联系我们
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="pb-20 px-4 lg:px-8">
        <div className="max-w-[900px] mx-auto space-y-12">
          {faqCategories.map((category) => (
            <div key={category.title}>
              <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">
                {category.title}
              </h2>
              <div className="space-y-4">
                {category.questions.map((item, index) => (
                  <details
                    key={index}
                    className="group bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-hairline)] overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-[var(--color-surface-card)] transition-colors">
                      <span className="font-semibold text-[var(--color-ink)]">
                        {item.q}
                      </span>
                      <ChevronDown className="w-5 h-5 text-[var(--color-mute)] shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-6 pb-6 text-[var(--color-body)] leading-relaxed">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 px-4 lg:px-8 bg-[var(--color-surface-card)]">
        <div className="max-w-[600px] mx-auto text-center">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4">
            还有疑问？
          </h2>
          <p className="text-[var(--color-mute)] mb-6">
            如果以上问题没有解决你的疑惑，欢迎直接联系我们的客服团队。
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 bg-[var(--color-primary)] text-white dark:bg-white dark:text-black font-semibold rounded-full hover:bg-[var(--color-primary-pressed)] dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            联系我们
          </Link>
        </div>
      </section>
    </div>
  );
}