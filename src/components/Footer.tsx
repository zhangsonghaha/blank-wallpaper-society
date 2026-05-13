import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--color-canvas)] border-t border-[var(--color-hairline)]">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
        {/* Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Column 1 */}
          <div>
            <h4 className="text-xs font-bold text-[var(--color-mute)] uppercase tracking-wider mb-4">
              获取应用
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://apps.apple.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  iOS 应用
                </a>
              </li>
              <li>
                <a
                  href="https://play.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Android 应用
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2 */}
          <div>
            <h4 className="text-xs font-bold text-[var(--color-mute)] uppercase tracking-wider mb-4">
              快速链接
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  探索
                </Link>
              </li>
              <li>
                <Link
                  href="/#popular"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  热门图片
                </Link>
              </li>
              <li>
                <Link
                  href="/profile"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  摄影师
                </Link>
              </li>
              <li>
                <Link
                  href="/#favorites"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  收藏夹
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h4 className="text-xs font-bold text-[var(--color-mute)] uppercase tracking-wider mb-4">
              关于
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  关于我们
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  博客
                </Link>
              </li>
              <li>
                <Link
                  href="/partners"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  合作伙伴
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 */}
          <div>
            <h4 className="text-xs font-bold text-[var(--color-mute)] uppercase tracking-wider mb-4">
              帮助
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/faq"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  常见问题
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  联系我们
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  隐私政策
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  服务条款
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-[var(--color-hairline-soft)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.78 3.44 8.73 8 9.58v-6.77h-2v-2.81h2V9.5c0-3.31 2.01-5.11 4.86-5.11 1.41 0 2.88.25 2.88.25v3.17h-1.62c-1.6 0-2.1.99-2.1 2.01v1.45h3.57l-.57 2.81h-3v6.77c4.56-.85 8-4.8 8-9.58C22 6.48 17.52 2 12 2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[var(--color-mute)]">ImageGallery</span>
          </Link>
          <p className="text-xs text-[var(--color-mute)]">
            &copy; 2026 ImageGallery. 灵感来源于 Pinterest 设计系统.
          </p>
        </div>
      </div>
    </footer>
  );
}