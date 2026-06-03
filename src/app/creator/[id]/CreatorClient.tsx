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
  BadgeCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";

interface CreatorUser {
  id: number;
  name: string;
  avatar: string | null;
  role: string;
  is_verified?: number;
  createdAt: string;
}

interface CreatorStats {
  totalImages: number;
  totalViews: number;
  totalDownloads: number;
}

export default function CreatorClient({
  user,
  images,
  stats,
}: {
  user: CreatorUser;
  images: any[];
  stats: CreatorStats;
}) {
  const { data: session } = useSession();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

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
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-purple-600 h-48 md:h-64" />

      <div className="max-w-[1200px] mx-auto px-4 lg:px-8 -mt-24 md:-mt-32 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Creator Info Card */}
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
                    <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-ink)] flex items-center gap-1">
                      {user.name}
                      {user.is_verified === 1 && <VerifiedBadge size={22} />}
                    </h1>
                    {!isSelf && isLoggedIn && (
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
                    )}
                    <div className="flex items-center gap-3 mt-2 justify-center md:justify-start">
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
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-6 md:px-8 py-6 bg-[var(--color-surface-card)] rounded-b-2xl">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center mx-auto mb-2">
                      <UserCheck className="w-5 h-5 text-pink-600" />
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-ink)]">
                      {followersCount}
                    </p>
                    <p className="text-xs text-[var(--color-mute)]">粉丝</p>
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

          {/* Masonry Grid of Wallpapers */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-4">
              壁纸作品
            </h2>
            {images.length > 0 ? (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
                {images.map((img, index) => (
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