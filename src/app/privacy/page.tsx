import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策",
  description: "了解 ImageGallery 如何收集、使用和保护你的个人信息。",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] py-20 px-4 lg:px-8">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-8">
          隐私政策
        </h1>
        <p className="text-[var(--color-mute)] mb-12">
          最后更新日期：2026 年 5 月 1 日
        </p>

        <div className="space-y-10 text-[var(--color-body)] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              1. 概述
            </h2>
            <p>
              ImageGallery（以下简称「我们」或「平台」）非常重视用户的隐私保护。
              本隐私政策旨在向你说明我们如何收集、使用、存储和保护你的个人信息。
              使用我们的服务即表示你同意本隐私政策的内容。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              2. 我们收集的信息
            </h2>
            <div className="space-y-3">
              <p>
                <strong className="text-[var(--color-ink)]">账户信息：</strong>
                当你注册账户时，我们会收集你的邮箱地址、用户名和密码。你也可以选择提供头像、个人简介等额外信息。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">使用数据：</strong>
                我们自动收集你使用平台时的信息，包括 IP 地址、设备类型、浏览器类型、访问时间、浏览的页面和点击记录等。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">内容数据：</strong>
                你上传的图片、评论、收藏记录和用户互动数据。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">Cookie 和类似技术：</strong>
                我们使用 Cookie 和本地存储来改善用户体验，分析使用情况和保存你的偏好设置。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              3. 我们如何使用你的信息
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>提供、维护和改进我们的服务</li>
              <li>处理你的账户注册和登录认证</li>
              <li>向你推荐可能感兴趣的壁纸和内容</li>
              <li>发送服务通知和营销信息（你可以随时退订）</li>
              <li>分析和理解用户行为以优化产品</li>
              <li>防止欺诈和滥用行为</li>
              <li>遵守适用法律和法规</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              4. 数据共享与披露
            </h2>
            <p className="mb-3">
              我们不会将你的个人信息出售给第三方。在以下情况下，我们可能会共享你的信息：
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>服务提供商：</strong>我们聘请的第三方公司协助我们提供服务，如云服务、数据分析等。
              </li>
              <li>
                <strong>法律要求：</strong>当法律要求或政府机关依法提出请求时。
              </li>
              <li>
                <strong>企业交易：</strong>在合并、收购或资产出售的情况下。
              </li>
              <li>
                <strong>经你同意：</strong>当你明确授权我们分享时。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              5. 数据安全
            </h2>
            <p>
              我们采用行业标准的安全措施来保护你的个人信息，包括加密传输、安全存储和访问控制。
              我们会定期审查和更新安全措施以应对新的安全威胁。但请注意，任何互联网传输都无法保证 100% 安全。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              6. 你的权利
            </h2>
            <p className="mb-3">根据适用的数据保护法，你拥有以下权利：</p>
            <ul className="list-disc list-inside space-y-2">
              <li>访问你的个人数据</li>
              <li>更正不准确的个人信息</li>
              <li>删除你的个人信息（在某些情况下）</li>
              <li>限制或反对处理你的个人信息</li>
              <li>数据可携带权</li>
              <li>撤回同意的权利</li>
            </ul>
            <p className="mt-3">
              如需行使以上权利，请通过页面底部的联系方式与我们取得联系。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              7. 数据保留
            </h2>
            <p>
              我们只会在实现本隐私政策所述目的所必需的期限内保留你的个人信息，
              除非法律要求或允许更长的保留期。当你删除账户时，我们会在合理时间内删除或匿名化你的个人数据。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              8. 儿童隐私
            </h2>
            <p>
              我们的服务不适合 14 岁以下的儿童使用。我们不会故意收集儿童的个人信息。
              如果你发现儿童向我们提供了个人信息，请联系我们，我们将尽快删除相关信息。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              9. 隐私政策的变更
            </h2>
            <p>
              我们可能会不时更新本隐私政策。任何重大变更将通过平台通知或邮件告知你。
              继续使用我们的服务即表示你接受更新后的隐私政策。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              10. 联系我们
            </h2>
            <p>
              如果你对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
              <br />
              邮箱：privacy@imagegallery.app
              <br />
              地址：中国 · 上海
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}