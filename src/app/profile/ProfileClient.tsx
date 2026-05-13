"use client";

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Grid3X3,
  Lock,
  Key,
  Copy,
  Check,
  Power,
  PowerOff,
  BarChart3,
  AlertTriangle,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import CollectionDialog from "@/components/CollectionDialog";

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

  // 收藏图片
  const [favoriteImages, setFavoriteImages] = useState<any[]>([]);
  const [loadingFav, setLoadingFav] = useState(true);

  // 上传历史
  const [uploadedImages, setUploadedImages] = useState<any[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [uploadFilter, setUploadFilter] = useState<string>("all");
  const [uploadStats, setUploadStats] = useState<Record<string, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // 我的合集
  const [myCollections, setMyCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);

  // API Key管理
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyLimit, setNewKeyLimit] = useState(1000);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<any>(null);
  const [deletingKey, setDeletingKey] = useState(false);

  // 加载上传历史
  const fetchUploads = useCallback((status?: string) => {
    setLoadingUploads(true);
    const params = new URLSearchParams({ limit: "50" });
    if (status && status !== "all") params.set("status", status);
    fetch(`/api/user/uploads?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setUploadedImages(data.data || []);
        setUploadStats(data.stats || { pending: 0, approved: 0, rejected: 0 });
        setLoadingUploads(false);
      })
      .catch(() => setLoadingUploads(false));
  }, []);

  useEffect(() => {
    fetchUploads(uploadFilter === "all" ? undefined : uploadFilter);
  }, [uploadFilter, fetchUploads]);

  useEffect(() => {
    fetch("/api/images?limit=50")
      .then((res) => res.json())
      .then((data) => {
        const favs = (data.data || []).filter((img: any) => img.is_favorite === 1);
        setFavoriteImages(favs);
        setLoadingFav(false);
      })
      .catch(() => setLoadingFav(false));
  }, []);

  // 加载我的合集
  useEffect(() => {
    fetch(`/api/collections?userId=${user.id}&limit=50`)
      .then((res) => res.json())
      .then((data) => {
        setMyCollections(data.data || []);
        setLoadingCollections(false);
      })
      .catch(() => setLoadingCollections(false));
  }, [user.id]);

  // 加载API Keys
  const fetchApiKeys = useCallback(() => {
    setLoadingApiKeys(true);
    fetch("/api/api-keys")
      .then((res) => res.json())
      .then((data) => {
        setApiKeys(data.data || []);
        setLoadingApiKeys(false);
      })
      .catch(() => setLoadingApiKeys(false));
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

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

  const handleDeleteUpload = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/uploads?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("删除成功");
        setUploadedImages((prev) => prev.filter((img) => img.id !== deleteTarget.id));
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
    setDeleting(false);
  };

  const getStatusBadge = (status: string, rejectReason?: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="rounded-full text-xs gap-1 bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="w-3 h-3" />
            待审核
          </Badge>
        );
      case "approved":
        return (
          <Badge className="rounded-full text-xs gap-1 bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="w-3 h-3" />
            已通过
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="rounded-full text-xs gap-1 bg-red-100 text-red-700 border-red-300" title={rejectReason || ""}>
            <XCircle className="w-3 h-3" />
            已拒绝
          </Badge>
        );
      default:
        return null;
    }
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

              {/* Tabs: Favorites + Uploads */}
              <Separator />
              <div className="px-6 md:px-8 py-6">
                <Tabs defaultValue="favorites">
                  <TabsList variant="line">
                    <TabsTrigger value="favorites">
                      <Heart className="w-4 h-4" />
                      收藏
                    </TabsTrigger>
                    <TabsTrigger value="collections">
                      <Grid3X3 className="w-4 h-4" />
                      我的合集
                    </TabsTrigger>
                    <TabsTrigger value="api-keys">
                      <Key className="w-4 h-4" />
                      API Key
                    </TabsTrigger>
                    <TabsTrigger value="uploads">
                      <Upload className="w-4 h-4" />
                      上传历史
                      {uploadStats.pending > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full">
                          {uploadStats.pending}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  {/* Favorites Tab */}
                  <TabsContent value="favorites">
                    <div className="mt-4">
                      {loadingFav ? (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
                          ))}
                        </div>
                      ) : favoriteImages.length > 0 ? (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                          {favoriteImages.slice(0, 8).map((img) => (
                            <Link
                              key={img.id}
                              href={`/?pin=${img.id}`}
                              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--color-surface-card)] hover:shadow-md transition-shadow"
                            >
                              <img
                                src={img.thumbnail_url || img.url}
                                alt={img.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-xs text-white font-medium truncate">{img.title}</p>
                                <p className="text-[10px] text-white/70 truncate">{img.author}</p>
                              </div>
                              <div className="absolute top-2 right-2">
                                <Heart className="w-4 h-4 text-white fill-[var(--color-primary)]" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Heart className="w-10 h-10 text-[var(--color-ash)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-mute)] mb-3">还没有收藏任何图片</p>
                          <Link
                            href="/"
                            className="inline-block px-4 py-2 text-sm font-bold text-white bg-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors"
                          >
                            去探索
                          </Link>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Collections Tab */}
                  <TabsContent value="collections">
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-[var(--color-mute)]">
                          共 {myCollections.length} 个合集
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setCreateCollectionOpen(true)}
                          className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1 text-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          创建合集
                        </Button>
                      </div>

                      {loadingCollections ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="aspect-[4/3] rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
                          ))}
                        </div>
                      ) : myCollections.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {myCollections.map((col: any) => (
                            <Link
                              key={col.id}
                              href={`/collections/${col.id}`}
                              className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-[var(--color-surface-card)] hover:shadow-md transition-shadow"
                            >
                              {col.cover_thumbnail_url || col.cover_url ? (
                                <img
                                  src={col.cover_thumbnail_url || col.cover_url}
                                  alt={col.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)]/20 to-purple-200 flex items-center justify-center">
                                  <Grid3X3 className="w-8 h-8 text-[var(--color-primary)]/40" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-xs text-white font-medium truncate">{col.title}</p>
                                <p className="text-[10px] text-white/70">{col.image_count || 0} 张图片</p>
                              </div>
                              {!col.is_public && (
                                <div className="absolute top-2 right-2">
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded-full">
                                    <Lock className="w-2.5 h-2.5" /> 私密
                                  </span>
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Grid3X3 className="w-10 h-10 text-[var(--color-ash)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-mute)] mb-3">还没有创建任何合集</p>
                          <Button
                            onClick={() => setCreateCollectionOpen(true)}
                            className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1 text-sm"
                          >
                            创建合集
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* API Keys Tab */}
                  <TabsContent value="api-keys">
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-[var(--color-mute)]">
                          管理您的 API Key（最多 5 个）
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setNewKeyName("");
                            setNewKeyLimit(1000);
                            setNewKeyResult(null);
                            setCreateKeyOpen(true);
                          }}
                          className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1 text-xs"
                        >
                          <Key className="w-3.5 h-3.5" />
                          创建 Key
                        </Button>
                      </div>

                      {loadingApiKeys ? (
                        <div className="space-y-3">
                          {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="h-20 rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
                          ))}
                        </div>
                      ) : apiKeys.length > 0 ? (
                        <div className="space-y-3">
                          {apiKeys.map((key) => (
                            <Card key={key.id} className="rounded-xl border-none bg-[var(--color-surface-card)]">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm text-[var(--color-ink)]">{key.name}</span>
                                      <Badge
                                        className={`rounded-full text-[10px] ${
                                          key.is_active
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-gray-100 text-gray-500"
                                        }`}
                                      >
                                        {key.is_active ? "启用" : "禁用"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-[var(--color-mute)]">
                                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{key.key_prefix}••••••</span>
                                      <span>限额: {key.rate_limit}/天</span>
                                      <span>今日: {key.usage?.today || 0}</span>
                                      <span>7天: {key.usage?.last7days || 0}</span>
                                    </div>
                                    {key.last_used_at && (
                                      <p className="text-[10px] text-[var(--color-mute)] mt-1">
                                        最后使用: {new Date(key.last_used_at).toLocaleString("zh-CN")}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/api-keys/${key.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ is_active: !key.is_active }),
                                          });
                                          if (res.ok) {
                                            fetchApiKeys();
                                            toast.success(key.is_active ? "已禁用" : "已启用");
                                          }
                                        } catch {
                                          toast.error("操作失败");
                                        }
                                      }}
                                      className="rounded-lg h-8 w-8 p-0"
                                      title={key.is_active ? "禁用" : "启用"}
                                    >
                                      {key.is_active ? (
                                        <PowerOff className="w-3.5 h-3.5 text-amber-500" />
                                      ) : (
                                        <Power className="w-3.5 h-3.5 text-emerald-500" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setDeleteKeyTarget(key);
                                        setDeleteKeyDialogOpen(true);
                                      }}
                                      className="rounded-lg h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          <Link
                            href="/api-docs"
                            className="flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline mt-2"
                          >
                            <BarChart3 className="w-4 h-4" />
                            查看 API 文档
                          </Link>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Key className="w-10 h-10 text-[var(--color-ash)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-mute)] mb-3">还没有创建 API Key</p>
                          <Button
                            onClick={() => {
                              setNewKeyName("");
                              setNewKeyLimit(1000);
                              setNewKeyResult(null);
                              setCreateKeyOpen(true);
                            }}
                            className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1 text-sm"
                          >
                            <Key className="w-4 h-4" />
                            创建 API Key
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Uploads Tab */}
                  <TabsContent value="uploads">
                    <div className="mt-4">
                      {/* Filter Chips */}
                      <div className="flex items-center gap-2 mb-4">
                        {[
                          { key: "all", label: "全部" },
                          { key: "pending", label: `待审核 (${uploadStats.pending})` },
                          { key: "approved", label: `已通过 (${uploadStats.approved})` },
                          { key: "rejected", label: `已拒绝 (${uploadStats.rejected})` },
                        ].map((f) => (
                          <button
                            key={f.key}
                            onClick={() => setUploadFilter(f.key)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                              uploadFilter === f.key
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-[var(--color-surface-card)] text-[var(--color-mute)] hover:bg-[var(--color-surface-card)]/80"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                        <div className="flex-1" />
                        <Link href="/upload">
                          <Button size="sm" className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1 text-xs">
                            <Upload className="w-3.5 h-3.5" />
                            上传新壁纸
                          </Button>
                        </Link>
                      </div>

                      {loadingUploads ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
                          ))}
                        </div>
                      ) : uploadedImages.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {uploadedImages.map((img) => (
                            <div
                              key={img.id}
                              className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--color-surface-card)] hover:shadow-md transition-shadow"
                            >
                              <img
                                src={img.thumbnail_url || img.url}
                                alt={img.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute top-2 left-2">
                                {getStatusBadge(img.status, img.reject_reason)}
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-xs text-white font-medium truncate">{img.title}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className="text-[10px] text-white/70">{img.width}x{img.height}</p>
                                  <button
                                    onClick={() => {
                                      setDeleteTarget(img);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="p-1 rounded-full bg-red-500/80 hover:bg-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3 text-white" />
                                  </button>
                                </div>
                                {img.status === "rejected" && img.reject_reason && (
                                  <p className="text-[10px] text-red-300 mt-1 truncate" title={img.reject_reason}>
                                    原因: {img.reject_reason}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Upload className="w-10 h-10 text-[var(--color-ash)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-mute)] mb-3">还没有上传任何壁纸</p>
                          <Link
                            href="/upload"
                            className="inline-block px-4 py-2 text-sm font-bold text-white bg-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary-pressed)] transition-colors"
                          >
                            去上传
                          </Link>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Delete Confirmation Dialog */}
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>确认删除</DialogTitle>
                    <DialogDescription>
                      确定要删除壁纸「{deleteTarget?.title}」吗？此操作不可撤销。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(false)}
                      className="rounded-full"
                      disabled={deleting}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={handleDeleteUpload}
                      disabled={deleting}
                      className="rounded-full bg-red-500 hover:bg-red-600 gap-1"
                    >
                      {deleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          删除中...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          确认删除
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Create API Key Dialog */}
              <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>创建 API Key</DialogTitle>
                    <DialogDescription>
                      创建后将显示完整 Key，请立即保存。之后只能查看前缀。
                    </DialogDescription>
                  </DialogHeader>
                  {newKeyResult ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span className="font-medium text-emerald-700">创建成功</span>
                        </div>
                        <div className="bg-white rounded-lg p-3 font-mono text-sm break-all relative">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(newKeyResult.key);
                              setCopiedKey(true);
                              setTimeout(() => setCopiedKey(false), 2000);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-gray-100"
                          >
                            {copiedKey ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          {newKeyResult.key}
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">
                          请立即复制并保存此 Key，关闭后将无法再次查看完整 Key。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label className="mb-1.5 block">Key 名称</Label>
                        <Input
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="例如：我的应用"
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block">每日请求限额</Label>
                        <Input
                          type="number"
                          value={newKeyLimit}
                          onChange={(e) => setNewKeyLimit(parseInt(e.target.value) || 1000)}
                          min={1}
                          max={100000}
                          className="rounded-xl"
                        />
                        <p className="text-xs text-[var(--color-mute)] mt-1">默认 1000 次/天，最大 100000</p>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    {newKeyResult ? (
                      <Button
                        onClick={() => {
                          setCreateKeyOpen(false);
                          setNewKeyResult(null);
                          fetchApiKeys();
                        }}
                        className="rounded-full bg-[var(--color-primary)]"
                      >
                        我已保存
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setCreateKeyOpen(false)}
                          className="rounded-full"
                          disabled={creatingKey}
                        >
                          取消
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!newKeyName.trim()) {
                              toast.error("请输入Key名称");
                              return;
                            }
                            setCreatingKey(true);
                            try {
                              const res = await fetch("/api/api-keys", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newKeyName, rate_limit: newKeyLimit }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setNewKeyResult(data.data);
                                toast.success("API Key 创建成功");
                              } else {
                                toast.error(data.error || "创建失败");
                              }
                            } catch {
                              toast.error("创建失败");
                            }
                            setCreatingKey(false);
                          }}
                          disabled={creatingKey}
                          className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1"
                        >
                          {creatingKey ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              创建中...
                            </>
                          ) : (
                            <>
                              <Key className="w-4 h-4" />
                              创建
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete API Key Dialog */}
              <Dialog open={deleteKeyDialogOpen} onOpenChange={setDeleteKeyDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>删除 API Key</DialogTitle>
                    <DialogDescription>
                      确定要删除 Key「{deleteKeyTarget?.name}」吗？使用此 Key 的应用将无法继续访问 API。此操作不可撤销。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteKeyDialogOpen(false)}
                      className="rounded-full"
                      disabled={deletingKey}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!deleteKeyTarget) return;
                        setDeletingKey(true);
                        try {
                          const res = await fetch(`/api/api-keys/${deleteKeyTarget.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) {
                            toast.success("已删除");
                            setDeleteKeyDialogOpen(false);
                            setDeleteKeyTarget(null);
                            fetchApiKeys();
                          } else {
                            const data = await res.json();
                            toast.error(data.error || "删除失败");
                          }
                        } catch {
                          toast.error("删除失败");
                        }
                        setDeletingKey(false);
                      }}
                      disabled={deletingKey}
                      className="rounded-full bg-red-500 hover:bg-red-600 gap-1"
                    >
                      {deletingKey ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          删除中...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          确认删除
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Create Collection Dialog */}
              <CollectionDialog
                open={createCollectionOpen}
                onOpenChange={setCreateCollectionOpen}
                onSuccess={() => {
                  setCreateCollectionOpen(false);
                  fetch(`/api/collections?userId=${user.id}&limit=50`)
                    .then((res) => res.json())
                    .then((data) => setMyCollections(data.data || []));
                }}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}