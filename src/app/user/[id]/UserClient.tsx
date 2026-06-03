"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Eye,
  Download,
  Calendar,
  Shield,
  UserPlus,
  UserCheck,
  Globe,
  ExternalLink,
  FolderOpen,
  Loader2,
  Heart,
  Crown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import LevelBadge from "@/components/LevelBadge";
import VerifiedBadge from "@/components/VerifiedBadge";

interface UserInfo {
  id: number;
  name: string;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  socialLinks: Record<string, string> | null;
  isVerified: number;
  role: string;
  createdAt: string;
}

interface UserStats {
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
  totalFavorites: number;
}

interface FeaturedCollection {
  id: number;
  name: string;
  description: string | null;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
  image_count: number;
}

const SOCIAL_ICONS: Record<string, { label: string; icon: string; prefix: string }> = {
  weibo: { label: "微博", icon: "📢", prefix: "https://weibo.com/" },
  twitter: { label: "Twitter/X", icon: "🐦", prefix: "https://twitter.com/" },
  bilibili: { label: "B站", icon: "📺", prefix: "https://space.bilibili.com/" },
  xiaohongshu: { label: "小红书", icon: "📕", prefix: "https://xiaohongshu.com/" },
  instagram: { label: "Instagram", icon: "📸", prefix: "https://instagram.com/" },
  github: { label: "GitHub", icon: "💻", prefix: "https://github.com/" },
};

interface LevelData {
  level: number;
  title: string;
  exp: number;
  nextExp: number;
  prevExp: number;
  expProgress: number;
}

interface MembershipInfo {
  plan: string;
  startedAt: string | null;
  expiresAt: string | null;
  status: string;
}

export default function UserClient({
  user,
  stats,
  followers: initialFollowers,
  following: initialFollowing,
  featuredCollections,
  images,
  levelData,
  membershipInfo,
}: {
  user: UserInfo;
  stats: UserStats;
  followers: number;
  following: number;
  featuredCollections: FeaturedCollection[];
  images: any[];
  levelData: LevelData | null;
  membershipInfo: MembershipInfo | null;
}) {
  const { data: session } = useSession();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowers);
  const [followingCount, setFollowingCount] = useState(initialFollowing);
  const [followLoading, setFollowLoading] = useState(false);
  const [pageImages, setPageImages] = useState(images);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(images.length >= 24);

  const isLoggedIn = !!session?.user;
  const isSelf = Number((session?.user as any)?.id) === user.id;

  // 获取关注状态
  useEffect(() => {
    fetch(`/api/users/${user.id}/follow`)
      .then((res) => res.json())
      .then((data) => {
        setIsFollowing(data.isFollowing);
        setFollowersCount(data.followersCount);
        setFollowingCount(data.followingCount);
      })
      .catch(() => {});
  }, [user.id]);

  // 加载更多壁纸
  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`);
      const data = await res.json();
      // 使用公开API中的壁纸列表 - 通过直接查询
      const imgRes = await fetch(`/api/images?uploaderId=${user.id}&page=${nextPage}&limit=24`);
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        const newImages = imgData.data || [];
        setPageImages((prev) => [...prev, ...newImages]);
        setPage(nextPage);
        setHasMore(newImages.length >= 24);
      }
    } catch {
      // fallback: 不加载更多
    }
    setLoadingMore(false);
  };

  const handleFollow = async () => {
    if (!isLoggedIn) {
      toast.error("请先登录");
      return;
    }
    setFollowLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/follow`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setIsFollowing(data.following);
        setFollowersCount((prev) => data.following ? prev + 1 : prev - 1);
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("操作失败");
    }
    setFollowLoading(false);
  };

  const userInitial = user.name?.[0] || "?";
  const isAdmin = user.role === "admin";

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      {/* Banner */}
      <div className="relative h-48 md:h-64 lg:h-80 overflow-hidden pointer-events-none">
        {user.banner ? (
          <img
            src={user.banner}
            alt={`${user.name}的Banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[var(--color-primary)] to-purple-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 -mt-24 md:-mt-32 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* User Info Card */}
          <Card className="rounded-2xl border-none shadow-lg overflow-visible">
            <CardContent className="p-0">
              <div className="px-6 md:px-8 pb-6 pt-0">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-4 -mt-16 md:-mt-20">
                  <div className="shrink-0">
                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden ring-4 ring-white shadow-xl">
                      <Avatar className="w-full h-full">
                        <AvatarImage
                          src={user.avatar || ""}
                          alt={user.name}
                          className="object-cover w-full h-full"
                        />
                        <AvatarFallback className="bg-[var(--color-primary)] text-white text-4xl md:text-5xl font-bold w-full h-full">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <div className="text-center md:text-left flex-1 pt-2 md:pt-0">
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-ink)] flex items-center gap-1 justify-center md:justify-start">
                      {user.name}
                      {user.isVerified === 1 && <VerifiedBadge size={22} />}
                    </h1>
                    {/* 会员标识 */}
                    {membershipInfo && membershipInfo.status === "active" && (
                      <Badge className="rounded-full text-xs gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                        <Crown className="w-3 h-3" />
                        {membershipInfo.plan === "admin" ? "管理员" : membershipInfo.plan.includes("enterprise") ? "企业版会员" : "Pro 会员"}
                      </Badge>
                    )}
                    {/* 关注按钮 */}
                    {!isSelf && isLoggedIn && (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={`rounded-full gap-1 text-xs ${
                            isFollowing
                              ? "bg-[var(--color-secondary-bg)] text-[var(--color-body)] hover:bg-[var(--color-secondary-pressed)] border border-[var(--color-hairline)]"
                              : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-pressed)]"
                          }`}
                        >
                          {followLoading ? (
                            "..."
                          ) : isFollowing ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              已关注
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              关注
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    {/* 简介 */}
                    {user.bio && (
                      <p className="text-sm text-[var(--color-mute)] mt-2 max-w-lg">
                        {user.bio}
                      </p>
                    )}
                    {/* 标签 */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap justify-center md:justify-start">
                      {/* 等级徽章 */}
                      {levelData && (
                        <LevelBadge level={levelData.level} title={levelData.title} size="md" />
                      )}
                      {isAdmin && (
                        <Badge className="rounded-full text-xs gap-1 bg-amber-500">
                          <Shield className="w-3 h-3" />
                          管理员
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="rounded-full text-xs gap-1"
                      >
                        <Calendar className="w-3 h-3" />
                        {formatDate(user.createdAt)} 加入
                      </Badge>
                      <span className="text-sm text-[var(--color-mute)]">
                        <strong className="text-[var(--color-ink)]">{followersCount}</strong> 粉丝
                      </span>
                      <span className="text-sm text-[var(--color-mute)]">
                        <strong className="text-[var(--color-ink)]">{followingCount}</strong> 关注
                      </span>
                    </div>
                    {/* 社交链接 */}
                    {user.socialLinks && Object.keys(user.socialLinks).length > 0 && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap justify-center md:justify-start">
                        {Object.entries(user.socialLinks).map(([key, value]) => {
                          const platform = SOCIAL_ICONS[key];
                          if (!platform || !value) return null;
                          return (
                            <a
                              key={key}
                              href={value.startsWith("http") ? value : `${platform.prefix}${value}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-surface-card)] border border-[var(--color-hairline)] text-xs text-[var(--color-ink)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                            >
                              <span>{platform.icon}</span>
                              {platform.label}
                              <ExternalLink className="w-3 h-3 opacity-50" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                    {/* 经验值进度条 */}
                    {levelData && (
                      <div className="mt-3 max-w-xs mx-auto md:mx-0">
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)] mb-1">
                          <span>EXP {levelData.exp}</span>
                          <span>{levelData.nextExp}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${levelData.expProgress * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-[var(--color-primary)] to-purple-500 rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-6 md:px-8 py-6 bg-[var(--color-surface-card)] rounded-b-2xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-ink)]">
                      {stats.totalImages}
                    </p>
                    <p className="text-xs text-[var(--color-mute)]">壁纸</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                      <Eye className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-ink)]">
                      {stats.totalViews.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-mute)]">浏览</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                      <Heart className="w-5 h-5 text-red-500" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-ink)]">
                      {stats.totalFavorites?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-[var(--color-mute)]">收藏</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                      <Download className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-ink)]">
                      {stats.totalDownloads.toLocaleString()}
                    </p>
                    <p className="text-xs text-[var(--color-mute)]">下载</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 精选合集 */}
          {featuredCollections.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                精选合集
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featuredCollections.map((col) => (
                  <Link key={col.id} href={`/collections/${col.id}`}>
                    <Card className="rounded-xl overflow-hidden hover:shadow-lg transition-shadow group">
                      <div className="aspect-[16/9] bg-[var(--color-surface-card)] relative overflow-hidden">
                        {col.cover_thumbnail_url || col.cover_url ? (
                          <img
                            src={col.cover_thumbnail_url || col.cover_url || ""}
                            alt={col.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FolderOpen className="w-10 h-10 text-[var(--color-mute)]" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-[var(--color-ink)] truncate">{col.name}</h3>
                        <p className="text-xs text-[var(--color-mute)] mt-1">{col.image_count} 张壁纸</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 壁纸网格 */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              壁纸作品
            </h2>
            {pageImages.length > 0 ? (
              <>
                <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
                  {pageImages.map((img, index) => (
                    <motion.div
                      key={img.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    >
                      <Link
                        href={`/images/${img.id}`}
                        className="group block break-inside-avoid rounded-xl overflow-hidden bg-[var(--color-surface-card)] hover:shadow-lg transition-shadow"
                      >
                        <div className="relative">
                          <img
                            src={img.thumbnail_url || img.url}
                            alt={img.title}
                            className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-sm text-white font-medium truncate">
                              {img.title}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-white/70 flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {img.view_count || 0}
                              </span>
                              <span className="text-[10px] text-white/70 flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                {img.download_count || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-6 text-center">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-full gap-2"
                    >
                      {loadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {loadingMore ? "加载中..." : "加载更多"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <ImageIcon className="w-12 h-12 text-[var(--color-ash)] mx-auto mb-4" />
                <p className="text-[var(--color-mute)]">暂无公开壁纸</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}