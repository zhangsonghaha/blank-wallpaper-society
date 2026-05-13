"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useSearch } from "@/context/SearchContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  LogOut,
  User,
  LayoutDashboard,
  Settings,
  Upload,
  Grid3X3,
} from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { searchQuery, setSearchQuery, favoriteCount, setShowFavoritesOnly } = useSearch();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  const isAdmin = (session?.user as any)?.role === "admin";
  const isLoggedIn = status === "authenticated";

  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleSearch = (value: string) => {
    setLocalQuery(value);
    setSearchQuery(value);
  };

  const userInitial =
    session?.user?.name?.[0] ||
    session?.user?.email?.[0] ||
    "?";

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-[var(--color-hairline)]">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12c0 4.78 3.44 8.73 8 9.58v-6.77h-2v-2.81h2V9.5c0-3.31 2.01-5.11 4.86-5.11 1.41 0 2.88.25 2.88.25v3.17h-1.62c-1.6 0-2.1.99-2.1 2.01v1.45h3.57l-.57 2.81h-3v6.77c4.56-.85 8-4.8 8-9.58C22 6.48 17.52 2 12 2z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-[var(--color-ink)] tracking-tight hidden sm:block">
                ImageGallery
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-semibold text-[var(--color-ink)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                探索
              </Link>
              <Link
                href="/#popular"
                className="px-4 py-2 text-sm font-semibold text-[var(--color-mute)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                热门
              </Link>
              <Link
                href="/#favorites"
                className="relative px-4 py-2 text-sm font-semibold text-[var(--color-mute)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                收藏
                {favoriteCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--color-primary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {favoriteCount > 9 ? "9+" : favoriteCount}
                  </span>
                )}
              </Link>
              <Link
                href="/collections"
                className="px-4 py-2 text-sm font-semibold text-[var(--color-mute)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors flex items-center gap-1.5"
              >
                <Grid3X3 className="w-4 h-4" />
                合集
              </Link>
              {isLoggedIn && (
                <Link
                  href="/upload"
                  className="px-4 py-2 text-sm font-semibold text-[var(--color-mute)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" />
                  上传
                </Link>
              )}
            </div>
          </div>

          {/* Center: Search Bar (Desktop) */}
          <div className="hidden sm:flex flex-1 max-w-[480px] mx-4">
            <div className="relative w-full">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ash)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={localQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索图片、灵感..."
                className="w-full h-12 pl-11 pr-10 bg-[var(--color-surface-card)] text-[var(--color-ink)] text-base rounded-full placeholder:text-[var(--color-ash)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-outer)] focus:ring-offset-2 transition-all"
              />
              {localQuery && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-secondary-bg)] transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5 text-[var(--color-ash)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile Search Toggle */}
            <button
              className="sm:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              onClick={() => {
                setShowMobileSearch(!showMobileSearch);
                setIsMenuOpen(false);
              }}
            >
              <svg
                className="w-5 h-5 text-[var(--color-ink)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            {/* Favorite Button (Mobile) */}
            <button
              className="sm:hidden relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              onClick={() => {
                router.push("/#favorites");
              }}
            >
              <Heart className="w-5 h-5 text-[var(--color-ink)]" />
              {favoriteCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[var(--color-primary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {favoriteCount > 9 ? "9+" : favoriteCount}
                </span>
              )}
            </button>

            {/* User Area */}
            {status === "loading" ? (
              <div className="w-9 h-9 rounded-full bg-[var(--color-surface-card)] animate-pulse" />
            ) : isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-transparent hover:ring-[var(--color-primary)] transition-all">
                    <AvatarImage
                      src={session.user?.image || ""}
                      alt={session.user?.name || ""}
                    />
                    <AvatarFallback className="bg-[var(--color-primary)] text-white text-sm font-medium">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl mt-1"
                >
                  {/* 用户信息区域 - 必须用 DropdownMenuGroup 包裹 GroupLabel */}
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      <div className="flex flex-col py-1">
                        <span className="font-medium text-sm">
                          {session.user?.name}
                        </span>
                        <span className="text-xs text-[var(--color-mute)] font-normal">
                          {session.user?.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* 导航菜单项 - 使用 onClick 导航 */}
                  <DropdownMenuItem
                    onClick={() => router.push("/profile")}
                    className="cursor-pointer"
                  >
                    <User className="w-4 h-4 mr-2" />
                    个人主页
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/upload")}
                    className="cursor-pointer"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    上传壁纸
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/#favorites")}
                    className="cursor-pointer"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    我的收藏
                  </DropdownMenuItem>

                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-xs text-[var(--color-mute)]">
                          管理
                        </DropdownMenuLabel>
                      </DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => router.push("/admin")}
                        className="cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        管理后台
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="text-red-500 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-semibold text-[var(--color-ink)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2 text-sm font-bold text-white bg-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors active:scale-95"
                >
                  注册
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg
                className="w-5 h-5 text-[var(--color-ink)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden border-b border-[var(--color-hairline)] bg-white overflow-hidden"
          >
            <div className="px-4 py-3">
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ash)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={localQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="搜索图片、灵感..."
                  autoFocus
                  className="w-full h-11 pl-11 pr-10 bg-[var(--color-surface-card)] text-[var(--color-ink)] text-sm rounded-full placeholder:text-[var(--color-ash)] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-focus-outer)] transition-all"
                />
                {localQuery && (
                  <button
                    onClick={() => handleSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-secondary-bg)] transition-colors"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-[var(--color-ash)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-[var(--color-hairline)] bg-white overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              <Link
                href="/"
                className="block px-4 py-3 text-sm font-semibold text-[var(--color-ink)] rounded-lg hover:bg-[var(--color-surface-card)]"
              >
                探索
              </Link>
              <Link
                href="/#popular"
                className="block px-4 py-3 text-sm font-semibold text-[var(--color-mute)] rounded-lg hover:bg-[var(--color-surface-card)]"
              >
                热门
              </Link>
              <Link
                href="/#favorites"
                className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-mute)] rounded-lg hover:bg-[var(--color-surface-card)]"
              >
                收藏
                {favoriteCount > 0 && (
                  <span className="px-2 py-0.5 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full">
                    {favoriteCount}
                  </span>
                )}
              </Link>
              <hr className="border-[var(--color-hairline-soft)] my-2" />
              {isLoggedIn ? (
                <>
                  <div className="px-4 py-2 flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={session.user?.image || ""} />
                      <AvatarFallback className="bg-[var(--color-primary)] text-white text-xs">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {session.user?.name}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">
                        {session.user?.email}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--color-ink)] rounded-lg hover:bg-[var(--color-surface-card)]"
                  >
                    <User className="w-4 h-4" />
                    个人主页
                  </Link>
                  <Link
                    href="/upload"
                    className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--color-ink)] rounded-lg hover:bg-[var(--color-surface-card)]"
                  >
                    <Upload className="w-4 h-4" />
                    上传壁纸
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--color-ink)] rounded-lg hover:bg-[var(--color-surface-card)]"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      管理后台
                    </Link>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm font-semibold text-red-500 rounded-lg hover:bg-[var(--color-surface-card)]"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="block px-4 py-3 text-sm font-semibold text-[var(--color-ink)] rounded-lg hover:bg-[var(--color-surface-card)]"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="block px-4 py-3 text-sm font-bold text-white bg-[var(--color-primary)] rounded-full text-center hover:bg-[var(--color-primary-pressed)] active:scale-[0.98] transition-all"
                  >
                    注册
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}