"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  User,
  Mail,
  Calendar,
  Shield,
  Image as ImageIcon,
  Heart,
  Eye,
  Save,
  Camera,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface UserData {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  createdAt: string;
}

interface StatsData {
  totalImages: number;
  totalViews: number;
  totalFavorites: number;
}

export default function ProfileClient({
  user,
  stats,
}: {
  user: UserData;
  stats: StatsData;
}) {
  const { data: session, update: updateSession } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || "");
  const [uploading, setUploading] = useState(false);

  const isAdmin = user.role === "admin";
  const userInitial = user.name?.[0] || user.email?.[0] || "?";

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("昵称不能为空");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        toast.success("保存成功");
        setEditing(false);
        // 更新 session
        await updateSession();
      } else {
        const data = await res.json();
        toast.error("保存失败", { description: data.error });
      }
    } catch (err) {
      toast.error("保存失败", { description: "网络错误" });
    }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("头像已更新");
        // 立即显示新头像，无需刷新页面
        setAvatarUrl(data.avatar);
        await updateSession();
      } else {
        const data = await res.json();
        toast.error(data.error || "头像上传失败");
      }
    } catch (err) {
      toast.error("上传失败，请重试");
    }
    setUploading(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      <Toaster position="top-right" richColors />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-purple-600 h-48 md:h-64" />

      <div className="max-w-[960px] mx-auto px-4 lg:px-8 -mt-24 md:-mt-32 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Card */}
          <Card className="rounded-2xl border-none shadow-lg overflow-visible">
            <CardContent className="p-0">
              {/* Avatar + Basic Info */}
              <div className="px-6 md:px-8 pb-6 pt-0">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-4 -mt-16 md:-mt-20">
                  <div className="relative group shrink-0">
                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden ring-4 ring-white shadow-xl">
                      <Avatar className="w-full h-full">
                        <AvatarImage
                          src={avatarUrl}
                          alt={user.name}
                          className="object-cover w-full h-full"
                        />
                        <AvatarFallback className="bg-[var(--color-primary)] text-white text-4xl md:text-5xl font-bold w-full h-full">
                          {userInitial}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    {/* 悬停上传覆盖层 */}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                      {uploading ? (
                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Camera className="w-8 h-8 text-white" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <div className="text-center md:text-left flex-1 pt-2 md:pt-0">
                    <div className="flex items-center gap-3 justify-center md:justify-start">
                      {editing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="text-xl font-bold h-10 rounded-xl w-48"
                          />
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-full gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {saving ? "保存中..." : "保存"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(false);
                              setName(user.name);
                            }}
                            className="rounded-full"
                          >
                            取消
                          </Button>
                        </div>
                      ) : (
                        <>
                          <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-ink)]">
                            {user.name}
                          </h1>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(true)}
                            className="rounded-full text-xs"
                          >
                            编辑
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 justify-center md:justify-start">
                      <Badge
                        variant="secondary"
                        className="rounded-full text-xs gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </Badge>
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

              <Separator />

              {/* Stats Grid */}
              <div className="px-6 md:px-8 py-6">
                <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">
                  统计概览
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="rounded-xl border-none bg-[var(--color-surface-card)]">
                    <CardContent className="p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                        <ImageIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">
                        {stats.totalImages}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">上传图片</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border-none bg-[var(--color-surface-card)]">
                    <CardContent className="p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                        <Eye className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">
                        {stats.totalViews}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">总浏览</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border-none bg-[var(--color-surface-card)]">
                    <CardContent className="p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                        <Heart className="w-5 h-5 text-red-500" />
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">
                        {stats.totalFavorites}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">收藏</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Account Info */}
              <Separator />
              <div className="px-6 md:px-8 py-6">
                <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">
                  账号信息
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-[var(--color-surface-card)]">
                    <span className="text-sm text-[var(--color-mute)]">用户 ID</span>
                    <span className="text-sm font-medium">#{user.id}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-[var(--color-surface-card)]">
                    <span className="text-sm text-[var(--color-mute)]">邮箱</span>
                    <span className="text-sm font-medium">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-[var(--color-surface-card)]">
                    <span className="text-sm text-[var(--color-mute)]">角色</span>
                    <Badge
                      className={`rounded-full text-xs ${
                        isAdmin ? "bg-amber-500" : "bg-blue-500"
                      }`}
                    >
                      {isAdmin ? "管理员" : "普通用户"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-[var(--color-surface-card)]">
                    <span className="text-sm text-[var(--color-mute)]">注册时间</span>
                    <span className="text-sm font-medium">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}