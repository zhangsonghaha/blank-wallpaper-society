import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服务条款",
  description: "了解使用 ImageGallery 服务的条款和条件。",
};

export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] py-20 px-4 lg:px-8">
      <div className="max-w-[800px] mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-8">
          服务条款
        </h1>
        <p className="text-[var(--color-mute)] mb-12">
          最后更新日期：2026 年 5 月 1 日
        </p>

        <div className="space-y-10 text-[var(--color-body)] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              1. 接受条款
            </h2>
            <p>
              欢迎使用 ImageGallery！通过访问或使用我们的网站、移动应用及相关服务（以下简称「服务」），
              你同意受本服务条款（以下简称「条款」）的约束。如果你不同意本条款的任何部分，请停止使用我们的服务。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              2. 服务说明
            </h2>
            <p>
              ImageGallery 是一个在线视觉内容平台，提供壁纸浏览、搜索、下载、上传和分享等服务。
              我们致力于为用户提供高质量的视觉内容和良好的使用体验。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              3. 账户注册与安全
            </h2>
            <div className="space-y-3">
              <p>
                <strong className="text-[var(--color-ink)]">注册要求：</strong>
                使用部分服务需要注册账户。你必须提供真实、准确、完整的注册信息，并及时更新以保持信息的准确性。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">账户安全：</strong>
                你负责维护账户密码的安全，并对在你的账户下发生的所有活动负责。如果发现账户被未经授权使用，请立即通知我们。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">资格的取消：</strong>
                我们有权基于任何违反本条款的行为，暂停或终止你的账户。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              4. 用户内容
            </h2>
            <div className="space-y-3">
              <p>
                <strong className="text-[var(--color-ink)]">内容所有权：</strong>
                你保留你上传到平台的图片和其他内容（合称「用户内容」）的所有权。
                但上传时，你授予我们非独占的、全球性的、免版税的许可，以使用、复制、修改、展示和分发你的用户内容，
                以便运营和改进我们的服务。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">内容责任：</strong>
                你对你发布的内容负全部责任。你声明并保证：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>你拥有发布该内容的所有必要权利，或已获得必要的授权</li>
                <li>你的内容不侵犯任何第三方的知识产权、隐私权或其他权利</li>
                <li>你的内容不违反任何适用法律或法规</li>
                <li>你的内容不包含恶意软件、病毒或有害代码</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              5. 禁止行为
            </h2>
            <p className="mb-3">使用我们的服务时，你同意不：</p>
            <ul className="list-disc list-inside space-y-2">
              <li>使用自动化工具（机器人、爬虫等）大量下载内容</li>
              <li>尝试未经授权访问我们的服务器或数据库</li>
              <li>干扰或破坏服务的正常运行</li>
              <li>冒充他人或虚假陈述你的身份</li>
              <li>上传或传播非法、侵权、色情、暴力或其他不当内容</li>
              <li>骚扰、威胁或侵犯其他用户的权利</li>
              <li>将服务用于任何商业目的（除非获得明确授权）</li>
              <li>转售或分发从平台下载的内容</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              6. 知识产权
            </h2>
            <div className="space-y-3">
              <p>
                <strong className="text-[var(--color-ink)]">平台内容版权：</strong>
                平台的设计、代码、标志、原创内容和其他材料受版权和其他知识产权法律保护。未经我们明确许可，不得复制、修改或分发。
              </p>
              <p>
                <strong className="text-[var(--color-ink)]">用户内容的版权：</strong>
                用户上传的内容的版权归用户所有。下载和使用这些内容须遵守各自的授权许可（如 CC0、Unsplash 许可等）。
                请在使用前查看图片详情页的授权信息。
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              7. 免责声明
            </h2>
            <p>
              我们的服务按「现状」提供，不附任何明示或暗示的担保。我们不保证服务始终可用、无错误或安全。
              在法律允许的最大范围内，我们不对因使用或无法使用服务而导致的任何损失或损害承担责任。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              8. 赔偿责任
            </h2>
            <p>
              你同意赔偿并使我们免受因你违反本条款、侵犯第三方权利或违反适用法律而产生的任何索赔、
              损害、责任和费用（包括合理的律师费）。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              9. 服务变更与终止
            </h2>
            <p>
              我们保留随时修改或终止服务的权利，恕不另行通知。我们可能出于任何原因终止你的账户，
              包括但不限于违反本条款。服务终止后，本条款中按其性质应持续有效的条款将继续有效。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              10. 法律适用与争议解决
            </h2>
            <p>
              本条款受中华人民共和国法律管辖。与本条款有关的任何争议，应首先通过友好协商解决。
              协商不成的，任何一方可向平台所在地有管辖权的人民法院提起诉讼。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              11. 条款变更
            </h2>
            <p>
              我们可能会不时更新本服务条款。重大变更会通过平台通知或邮件告知你。
              继续使用我们的服务即表示你接受更新后的条款。建议你定期查看本条款。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              12. 联系我们
            </h2>
            <p>
              如果你对本服务条款有任何疑问，请通过以下方式联系我们：
              <br />
              邮箱：legal@imagegallery.app
              <br />
              地址：中国 · 上海
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}