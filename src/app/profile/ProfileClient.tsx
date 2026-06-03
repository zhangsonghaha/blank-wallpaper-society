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
  Download,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserCheck,
  Trophy,
  Crown,
  Sparkles,
  BadgeCheck as BadgeCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LevelBadge from "@/components/LevelBadge";
import AchievementCard from "@/components/AchievementCard";
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
import { withCsrfHeader } from "@/lib/csrf-client";
import CreatorApplicationForm from "@/components/CreatorApplicationForm";
import BrandProfileEditor from "@/components/BrandProfileEditor";
import VerifiedBadge from "@/components/VerifiedBadge";
import ProfileCustomizationDialog from "@/components/ProfileCustomizationDialog";
import EmailPreferenceDialog from "@/components/EmailPreferenceDialog";

interface UserData {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  is_verified?: number;
  createdAt: string;
}

interface StatsData {
  totalImages: number;
  totalViews: number;
  totalFavorites: number;
}

interface FollowStats {
  followers: number;
  following: number;
}

interface LevelData {
  userId: number;
  level: number;
  title: string;
  exp: number;
  nextExp: number;
  prevExp: number;
  expProgress: number;
}

interface AchievementData {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  conditionType: string;
  conditionValue: number;
  expReward: number;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  currentValue?: number;
}

/* ==================== 创作者认证入口（弹窗模式） ==================== */

function CreatorVerificationEntry({ userId }: { userId: number }) {
  const [verificationStatus, setVerificationStatus] = useState<{
    verification_status: "none" | "pending" | "approved" | "rejected";
    is_verified: number;
    verified_at: string | null;
    verification_applied_at: string | null;
    verification_rejected_reason: string | null;
    brand_name: string | null;
    brand_description: string | null;
    brand_website: string | null;
    social_links: Record<string, string> | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchStatus = useCallback(() => {
    setLoading(true);
    fetch("/api/creator/status")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.data) {
          setVerificationStatus(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 状态标签
  const statusBadge = (() => {
    if (loading) return <Badge className="rounded-full text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">加载中</Badge>;
    const s = verificationStatus?.verification_status;
    if (s === "approved") return <Badge className="rounded-full text-xs gap-1 bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"><CheckCircle className="w-3 h-3" />已认证</Badge>;
    if (s === "pending") return <Badge className="rounded-full text-xs gap-1 bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"><Clock className="w-3 h-3" />审核中</Badge>;
    if (s === "rejected") return <Badge className="rounded-full text-xs gap-1 bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"><XCircle className="w-3 h-3" />未通过</Badge>;
    return <Badge className="rounded-full text-xs gap-1 bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">未申请</Badge>;
  })();

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-ink)] flex items-center gap-2">
          <BadgeCheckIcon className="w-5 h-5" />
          创作者认证
        </h2>
        <div className="flex items-center gap-3">
          {statusBadge}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="rounded-full text-xs gap-1"
          >
            {verificationStatus?.verification_status === "approved" ? "管理认证" : "申请认证"}
          </Button>
        </div>
      </div>

      {/* 创作者认证弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheckIcon className="w-5 h-5" />
              创作者认证
            </DialogTitle>
            <DialogDescription>
              {verificationStatus?.verification_status === "approved"
                ? "管理您的创作者认证信息与品牌资料"
                : "成为认证创作者，获取专属标识、品牌主页和更多特权"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <CreatorApplicationForm
              status={verificationStatus}
              onStatusChange={() => { fetchStatus(); }}
            />
            {verificationStatus?.verification_status === "approved" && (
              <div className="mt-4">
                <BrandProfileEditor
                  initialData={
                    verificationStatus
                      ? {
                          brand_name: verificationStatus.brand_name || "",
                          brand_description: verificationStatus.brand_description || "",
                          brand_website: verificationStatus.brand_website || "",
                          social_links: verificationStatus.social_links,
                        }
                      : null
                  }
                  onSaveSuccess={fetchStatus}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ==================== 账号注销区域组件 ==================== */

function AccountDeletionZone({ userId }: { userId: number }) {
  const [deletionStatus, setDeletionStatus] = useState<{
    status: string;
    deletionRequestedAt: string | null;
    deletionScheduledAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // 加载注销状态
  useEffect(() => {
    fetch("/api/auth/account-deletion")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && !data.error) {
          setDeletionStatus(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 请求注销
  const handleRequestDeletion = async () => {
    if (!password) {
      toast.error("请输入密码");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/account-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("注销申请已提交", {
          description: data.message,
        });
        setDialogOpen(false);
        setPassword("");
        // 更新状态
        setDeletionStatus({
          status: "pending_deletion",
          deletionRequestedAt: new Date().toISOString(),
          deletionScheduledAt: data.scheduledAt,
        });
      } else {
        toast.error("操作失败", { description: data.error });
      }
    } catch {
      toast.error("操作失败，请重试");
    }
    setSubmitting(false);
  };

  // 取消注销
  const handleCancelDeletion = async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/auth/account-deletion", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("注销已取消", { description: data.message });
        setCancelDialogOpen(false);
        setDeletionStatus({
          status: "active",
          deletionRequestedAt: null,
          deletionScheduledAt: null,
        });
      } else {
        toast.error("取消失败", { description: data.error });
      }
    } catch {
      toast.error("取消失败，请重试");
    }
    setCancelling(false);
  };

  if (loading) {
    return (
      <div className="space-y-3 max-w-md">
        <div className="h-4 w-32 bg-[var(--color-surface-card)] rounded animate-pulse" />
        <div className="h-10 w-full bg-[var(--color-surface-card)] rounded animate-pulse" />
      </div>
    );
  }

  // 已注销
  if (deletionStatus?.status === "deleted") {
    return (
      <div className="p-4 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-600 dark:bg-[var(--color-surface-card)] dark:border-[var(--color-hairline)] dark:text-[var(--color-body)]">
        此账号已注销。
      </div>
    );
  }

  // 正在注销中
  if (deletionStatus?.status === "pending_deletion") {
    const scheduledAt = deletionStatus.deletionScheduledAt
      ? new Date(deletionStatus.deletionScheduledAt).toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "7天后";

    return (
      <div className="space-y-4 max-w-md">
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-800">
            您的账号注销申请已提交
          </p>
          <p className="text-sm text-amber-700 mt-1">
            账号将于 <span className="font-semibold">{scheduledAt}</span> 正式注销。在注销生效前，您可以随时取消注销申请。
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
          onClick={() => setCancelDialogOpen(true)}
        >
          <XCircle className="w-4 h-4" />
          取消注销
        </Button>

        {/* 取消注销确认 Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>取消注销申请</DialogTitle>
              <DialogDescription>
                确定要取消账号注销申请吗？取消后您的账号将恢复正常使用。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
                className="rounded-full"
              >
                返回
              </Button>
              <Button
                disabled={cancelling}
                onClick={handleCancelDeletion}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-full gap-2"
              >
                {cancelling ? "处理中..." : "确认取消注销"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // 正常状态 - 可以申请注销
  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-[var(--color-mute)]">
        注销账号后，您的个人信息将被清除，7天冷静期内可随时取消。请谨慎操作。
      </p>
      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
        <p className="font-medium">注销后将发生以下变更：</p>
        <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
          <li>您的昵称、邮箱、头像将被清除</li>
          <li>收藏、评论、关注等数据将被删除</li>
          <li>API Key 将被停用</li>
          <li>您上传的图片和创建的合集将保留（其他用户可能已收藏）</li>
          <li>7天冷静期内可随时取消注销</li>
        </ul>
      </div>
      <Button
        variant="destructive"
        className="rounded-full gap-1"
        onClick={() => setDialogOpen(true)}
      >
        <Trash2 className="w-4 h-4" />
        申请注销账号
      </Button>

      {/* 注销确认 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              确认注销账号
            </DialogTitle>
            <DialogDescription>
              此操作将启动账号注销流程，7天后账号将被永久注销。请输入密码确认。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>请输入密码以确认</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入当前密码"
              className="mt-2 h-10 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setPassword("");
              }}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={submitting || !password}
              onClick={handleRequestDeletion}
              className="rounded-full gap-2"
            >
              {submitting ? "提交中..." : "确认注销"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 存储配额展示条 */
function StorageQuotaBar() {
  const [quota, setQuota] = useState<{
    usedMB: number;
    quotaMB: number;
    usagePercent: number;
    remainingMB: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/quota")
      .then((r) => r.json())
      .then((data) => {
        if (data.quotaMB) setQuota(data);
      })
      .catch(() => {});
  }, []);

  if (!quota) return null;

  const getColor = () => {
    if (quota.usagePercent >= 90) return "bg-red-500";
    if (quota.usagePercent >= 70) return "bg-yellow-500";
    return "bg-[var(--color-primary)]";
  };

  return (
    <div className="mb-4 p-3 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-hairline)]">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-[var(--color-mute)]">
          存储空间：{quota.usedMB} MB / {quota.quotaMB >= 1024 ? `${(quota.quotaMB / 1024).toFixed(1)} GB` : `${quota.quotaMB} MB`}
        </span>
        <span className={`font-semibold ${quota.usagePercent >= 90 ? "text-red-500" : quota.usagePercent >= 70 ? "text-yellow-500" : "text-[var(--color-primary)]"}`}>
          {quota.usagePercent.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-[var(--color-surface-muted)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${Math.min(100, quota.usagePercent)}%` }}
        />
      </div>
      {quota.usagePercent >= 90 && (
        <p className="text-xs text-red-500 mt-1.5">存储空间不足，请删除部分图片或升级账号</p>
      )}
      {quota.usagePercent < 90 && (
        <p className="text-xs text-[var(--color-mute)] mt-1">剩余 {quota.remainingMB} MB</p>
      )}
    </div>
  );
}

export default function ProfileClient({
  user,
  stats,
}: {
  user: UserData;
  stats: StatsData;
}) {
  const { data: session, update: updateSession } = useSession();
  const [followStats, setFollowStats] = useState<FollowStats>({ followers: 0, following: 0 });
  const [loadingFollowStats, setLoadingFollowStats] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || "");
  const [uploading, setUploading] = useState(false);

  // 主页定制
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [featuredCollections, setFeaturedCollections] = useState<number[]>([]);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [profileCustomSaving, setProfileCustomSaving] = useState(false);
  const [profileCustomOpen, setProfileCustomOpen] = useState(false);
  const [emailPrefOpen, setEmailPrefOpen] = useState(false);

  const isAdmin = user.role === "admin";
  const userInitial = user.name?.[0] || user.email?.[0] || "?";

  // 会员信息
  const [membershipInfo, setMembershipInfo] = useState<{
    plan: string;
    startedAt: string;
    expiresAt: string;
    status: string;
  } | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(true);

  // 等级与成就
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [achievements, setAchievements] = useState<AchievementData[]>([]);
  const [loadingLevel, setLoadingLevel] = useState(true);

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

  // 下载历史
  const [downloadHistory, setDownloadHistory] = useState<any[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(true);
  const [downloadPage, setDownloadPage] = useState(1);
  const [downloadTotal, setDownloadTotal] = useState(0);

  // API Key管理
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(true);
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyLimit, setNewKeyLimit] = useState(1000);
  const [newKeyExpiry, setNewKeyExpiry] = useState(90); // 默认90天
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

  // 加载收藏列表
  const fetchFavorites = useCallback(() => {
    setLoadingFav(true);
    fetch("/api/favorites?limit=50")
      .then((res) => {
        if (!res.ok) return { data: [] };
        return res.json();
      })
      .then((data) => {
        setFavoriteImages(data.data || []);
        setLoadingFav(false);
      })
      .catch(() => setLoadingFav(false));
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

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

  // 加载下载历史
  const fetchDownloads = useCallback((page: number) => {
    setLoadingDownloads(true);
    fetch(`/api/user/downloads?page=${page}&limit=12`)
      .then((res) => {
        if (!res.ok) return { data: [], pagination: { total: 0 } };
        return res.json();
      })
      .then((data) => {
        setDownloadHistory(data.data || []);
        setDownloadTotal(data.pagination?.total || 0);
        setLoadingDownloads(false);
      })
      .catch(() => setLoadingDownloads(false));
  }, []);

  useEffect(() => {
    fetchDownloads(downloadPage);
  }, [downloadPage, fetchDownloads]);

  // 加载等级与成就
  useEffect(() => {
    setLoadingLevel(true);
    fetch("/api/user/level")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) {
          setLevelData(data.level);
          setAchievements(data.achievements?.list || []);
        }
        setLoadingLevel(false);
      })
      .catch(() => setLoadingLevel(false));
  }, []);

  // 加载关注统计
  const fetchFollowStats = useCallback(() => {
    setLoadingFollowStats(true);
    fetch("/api/user/follow-stats")
      .then((res) => res.json())
      .then((data) => {
        setFollowStats(data);
        setLoadingFollowStats(false);
      })
      .catch(() => setLoadingFollowStats(false));
  }, []);

  useEffect(() => {
    fetchFollowStats();
  }, [fetchFollowStats]);

  // 加载主页定制信息
  useEffect(() => {
    fetch("/api/user/profile-customization")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data) {
          setBannerUrl(data.banner || "");
          setBio(data.bio || "");
          setSocialLinks(data.social_links || {});
          setFeaturedCollections(data.featured_collections || []);
        }
      })
      .catch(() => {});
  }, []);

  // 加载会员信息
  useEffect(() => {
    setLoadingMembership(true);
    fetch("/api/user/membership")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data && data.membership) {
          setMembershipInfo(data.membership);
        }
        setLoadingMembership(false);
      })
      .catch(() => setLoadingMembership(false));
  }, []);

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
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
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

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { ...csrfHeaders },
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
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/user/uploads?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders },
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
          <Badge className="rounded-full text-xs gap-1 bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
            <Clock className="w-3 h-3" />
            待审核
          </Badge>
        );
      case "approved":
        return (
          <Badge className="rounded-full text-xs gap-1 bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
            <CheckCircle className="w-3 h-3" />
            已通过
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="rounded-full text-xs gap-1 bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800" title={rejectReason || ""}>
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
      <div className="relative h-40 md:h-52 group">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt="主页Banner"
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[var(--color-primary)] to-purple-600 pointer-events-none" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
        {/* Banner上传按钮 — 右上角小按钮，hover时显示 */}
        <label className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-full text-white text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10">
          {bannerUploading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          <span>{bannerUploading ? "上传中..." : "更换Banner"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBannerUploading(true);
              try {
                const fd = new FormData();
                fd.append("banner", file);
                const csrfHeaders = await withCsrfHeader();
                const res = await fetch("/api/user/profile-customization", {
                  method: "PATCH",
                  headers: { ...csrfHeaders },
                  body: fd,
                });
                if (res.ok) {
                  const data = await res.json();
                  setBannerUrl(data.banner);
                  toast.success("Banner已更新");
                } else {
                  const data = await res.json();
                  toast.error(data.error || "Banner上传失败");
                }
              } catch {
                toast.error("上传失败，请重试");
              }
              setBannerUploading(false);
            }}
            disabled={bannerUploading}
          />
        </label>
      </div>

      <div className="max-w-[960px] mx-auto px-4 lg:px-8 -mt-12 md:-mt-16 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Card */}
          <Card className="rounded-2xl border-none shadow-lg overflow-visible relative z-10">
            <CardContent className="p-0">
              {/* Avatar + Basic Info */}
              <div className="px-6 md:px-8 pb-6 pt-4 md:pt-6">
                <div className="flex flex-col md:flex-row items-center md:items-end gap-4 -mt-14 md:-mt-20">
                  <div className="relative group shrink-0">
                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-800 shadow-xl">
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
                          {user.is_verified === 1 && <VerifiedBadge size={22} />}
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
                    {/* 简介 */}
                    {bio && (
                      <p className="text-sm text-[var(--color-mute)] mt-2 max-w-lg">
                        {bio}
                      </p>
                    )}
                    {/* 社交链接 */}
                    {socialLinks && Object.values(socialLinks).some(v => v?.trim()) && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap justify-center md:justify-start">
                        {Object.entries(socialLinks).map(([key, value]) => {
                          if (!value?.trim()) return null;
                          const platformMap: Record<string, { label: string; icon: string; prefix: string }> = {
                            weibo: { label: "微博", icon: "📢", prefix: "https://weibo.com/" },
                            twitter: { label: "Twitter/X", icon: "🐦", prefix: "https://twitter.com/" },
                            bilibili: { label: "B站", icon: "📺", prefix: "https://space.bilibili.com/" },
                            xiaohongshu: { label: "小红书", icon: "📕", prefix: "https://xiaohongshu.com/" },
                            instagram: { label: "Instagram", icon: "📸", prefix: "https://instagram.com/" },
                            github: { label: "GitHub", icon: "💻", prefix: "https://github.com/" },
                          };
                          const platform = platformMap[key];
                          if (!platform) return null;
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
                            </a>
                          );
                        })}
                      </div>
                    )}
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
                      {membershipInfo && membershipInfo.status === "active" && !isAdmin && (
                        <Badge className="rounded-full text-xs gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          <Crown className="w-3 h-3" />
                          {membershipInfo.plan.includes("enterprise") ? "企业版会员" : "Pro 会员"}
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
                    {/* 等级徽章 + 经验值进度条 */}
                    {!loadingLevel && levelData && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-3 justify-center md:justify-start">
                          <LevelBadge level={levelData.level} title={levelData.title} size="md" />
                        </div>
                        <div className="max-w-xs mx-auto md:mx-0">
                          <div className="flex items-center justify-between text-[10px] text-[var(--color-mute)] mb-1">
                            <span>EXP {levelData.exp}</span>
                            <span>{levelData.nextExp}</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${levelData.expProgress * 100}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-[var(--color-primary)] to-purple-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stats Grid */}
              <div className="px-6 md:px-8 py-6">
                <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">
                  统计概览
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  <Card className="rounded-xl border-none bg-[var(--color-surface-card)]">
                    <CardContent className="p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2">
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
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-2">
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
                      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-2">
                        <Heart className="w-5 h-5 text-red-500" />
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">
                        {stats.totalFavorites}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">收藏</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border-none bg-[var(--color-surface-card)]">
                    <CardContent className="p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-2">
                        <UserPlus className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">
                        {loadingFollowStats ? "..." : followStats.followers}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">粉丝</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-xl border-none bg-[var(--color-surface-card)]">
                    <CardContent className="p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mx-auto mb-2">
                        <UserCheck className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-ink)]">
                        {loadingFollowStats ? "..." : followStats.following}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">关注</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* 主页定制 - 紧凑按钮 + 弹窗 */}
              <Separator />
              <div className="px-6 md:px-8 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--color-ink)]">主页定制</h2>
                      <p className="text-xs text-[var(--color-mute)] mt-0.5">
                        {bio || (Object.values(socialLinks).some(v => v?.trim()) ? "" : "") || featuredCollections.length > 0
                          ? [
                              bio && "简介",
                              Object.values(socialLinks).some(v => v?.trim()) && "社交链接",
                              featuredCollections.length > 0 && `${featuredCollections.length}个精选合集`,
                            ].filter(Boolean).join(" · ")
                          : "设置简介、社交链接和精选合集"
                        }
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setProfileCustomOpen(true)}
                    className="rounded-full text-xs gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {bio || Object.values(socialLinks).some(v => v?.trim()) || featuredCollections.length > 0 ? "编辑" : "设置"}
                  </Button>
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
                  {/* 会员状态 */}
                  <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-[var(--color-surface-card)]">
                    <span className="text-sm text-[var(--color-mute)]">会员</span>
                    {isAdmin ? (
                      <Badge className="rounded-full text-xs gap-1 bg-gradient-to-r from-amber-500 to-red-500 text-white">
                        <Shield className="w-3 h-3" />
                        最高权限
                      </Badge>
                    ) : membershipInfo && membershipInfo.status === "active" ? (
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full text-xs gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                          <Crown className="w-3 h-3" />
                          {membershipInfo.plan.includes("enterprise") ? "企业版" : "Pro"}
                        </Badge>
                        <span className="text-xs text-[var(--color-mute)]">
                          到期 {new Date(membershipInfo.expiresAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    ) : (
                      <Link href="/pricing">
                        <Badge className="rounded-full text-xs gap-1 bg-[var(--color-primary)] text-white cursor-pointer hover:opacity-90 transition-opacity">
                          <Sparkles className="w-3 h-3" />
                          升级会员
                        </Badge>
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 px-4 rounded-lg bg-[var(--color-surface-card)]">
                    <span className="text-sm text-[var(--color-mute)]">注册时间</span>
                    <span className="text-sm font-medium">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <Separator />
              <div className="px-6 md:px-8 py-6">
                <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  修改密码
                </h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const currentPwd = (form.elements.namedItem("currentPassword") as HTMLInputElement).value;
                    const newPwd = (form.elements.namedItem("newPassword") as HTMLInputElement).value;
                    const confirmPwd = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

                    if (!currentPwd || !newPwd || !confirmPwd) {
                      toast.error("请填写所有字段");
                      return;
                    }
                    if (newPwd.length < 6) {
                      toast.error("新密码至少 6 个字符");
                      return;
                    }
                    if (newPwd !== confirmPwd) {
                      toast.error("两次输入的新密码不一致");
                      return;
                    }

                    try {
                      const res = await fetch("/api/auth/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          currentPassword: currentPwd,
                          newPassword: newPwd,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast.success("密码修改成功");
                        form.reset();
                      } else {
                        toast.error(data.error || "修改失败");
                      }
                    } catch {
                      toast.error("修改失败，请重试");
                    }
                  }}
                  className="space-y-4 max-w-md"
                >
                  <div>
                    <Label className="mb-1.5 block">当前密码</Label>
                    <Input
                      type="password"
                      name="currentPassword"
                      placeholder="请输入当前密码"
                      className="rounded-xl"
                      required
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">新密码</Label>
                    <Input
                      type="password"
                      name="newPassword"
                      placeholder="至少 6 个字符"
                      className="rounded-xl"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">确认新密码</Label>
                    <Input
                      type="password"
                      name="confirmPassword"
                      placeholder="再次输入新密码"
                      className="rounded-xl"
                      required
                      minLength={6}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1"
                  >
                    <Lock className="w-4 h-4" />
                    修改密码
                  </Button>
                </form>
              </div>

              {/* Data Export - GDPR */}
              <Separator />
              <div className="px-6 md:px-8 py-6">
                <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  数据导出
                </h2>
                <p className="text-sm text-[var(--color-mute)] mb-4">
                  根据 GDPR 数据可携带权，您可以导出所有个人数据。导出文件为 JSON 格式，包含您的个人信息、上传图片、收藏、评论、下载历史等。
                </p>
                <Button
                  onClick={async () => {
                    try {
                      toast.loading("正在准备导出数据...");
                      const res = await fetch("/api/user/export");
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `data_export_${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        toast.success("数据导出成功");
                      } else {
                        const data = await res.json();
                        toast.error(data.error || "导出失败");
                      }
                    } catch {
                      toast.error("导出失败，请重试");
                    }
                  }}
                  className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-1"
                >
                  <Download className="w-4 h-4" />
                  导出我的数据
                </Button>
              </div>

              {/* 邮件订阅偏好 - 紧凑按钮 + 弹窗 */}
              <Separator />
              <div className="px-6 md:px-8 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-[var(--color-primary)]" />
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--color-ink)]">邮件订阅</h2>
                      <p className="text-xs text-[var(--color-mute)] mt-0.5">
                        管理每周精选、活动通知等邮件偏好
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEmailPrefOpen(true)}
                    className="rounded-full text-xs gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    管理
                  </Button>
                </div>
              </div>

              {/* Account Deletion - 危险区域 */}
              <Separator />
              <div className="px-6 md:px-8 py-6">
                <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  注销账号
                </h2>
                <AccountDeletionZone userId={user.id} />
              </div>

              {/* 创作者认证入口 */}
              <Separator />
              <div className="px-6 md:px-8 py-6">
                <CreatorVerificationEntry userId={user.id} />
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
                    <TabsTrigger value="downloads">
                      <Download className="w-4 h-4" />
                      下载历史
                    </TabsTrigger>
                    <TabsTrigger value="uploads">
                      <Upload className="w-4 h-4" />
                      上传历史
                      {uploadStats.pending > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full dark:bg-yellow-900/20 dark:text-yellow-400">
                          {uploadStats.pending}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="achievements">
                      <Trophy className="w-4 h-4" />
                      成就
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
                              href={`/images/${img.id}`}
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
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  withCsrfHeader().then((csrfHeaders) => {
                                    fetch(`/api/favorites/${img.id}`, { method: "DELETE", headers: { ...csrfHeaders } })
                                      .then((res) => {
                                        if (res.ok) {
                                          setFavoriteImages((prev) => prev.filter((f: any) => f.id !== img.id));
                                          toast.success("已取消收藏");
                                        }
                                      })
                                      .catch(() => toast.error("操作失败"));
                                  });
                                }}
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              >
                                <Heart className="w-4 h-4 text-white fill-[var(--color-primary)] hover:scale-110 transition-transform" />
                              </button>
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
                                <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)]/20 to-purple-200 dark:to-purple-900/30 flex items-center justify-center">
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
                            setNewKeyExpiry(90);
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
                                          key.is_expired
                                            ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                            : key.is_active
                                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                        }`}
                                      >
                                        {key.is_expired ? "已过期" : key.is_active ? "启用" : "禁用"}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-[var(--color-mute)]">
                                      <span className="font-mono bg-gray-100 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded">{key.key_preview || `${key.key_prefix}****`}</span>
                                      <span>限额: {key.rate_limit}/天</span>
                                      <span>今日: {key.usage?.today || 0}</span>
                                      <span>7天: {key.usage?.last7days || 0}</span>
                                    </div>
                                    {key.expires_at && (
                                      <p className={`text-[10px] mt-1 ${key.is_expired ? "text-red-500 font-medium" : "text-[var(--color-mute)]"}`}>
                                        {key.is_expired ? "已过期" : "过期时间"}: {new Date(key.expires_at).toLocaleString("zh-CN")}
                                      </p>
                                    )}
                                    {!key.expires_at && (
                                      <p className="text-[10px] text-[var(--color-mute)] mt-1">永不过期</p>
                                    )}
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
                                          const csrfHeaders = await withCsrfHeader();
                                          const res = await fetch(`/api/api-keys/${key.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json", ...csrfHeaders },
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
                                      className="rounded-lg h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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

                  {/* Downloads Tab */}
                  <TabsContent value="downloads">
                    <div className="mt-4">
                      <p className="text-sm text-[var(--color-mute)] mb-4">
                        共 {downloadTotal} 条下载记录
                      </p>
                      {loadingDownloads ? (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="aspect-[3/4] rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
                          ))}
                        </div>
                      ) : downloadHistory.length > 0 ? (
                        <>
                          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                            {downloadHistory.map((item) => (
                              <Link
                                key={item.id}
                                href={`/images/${item.image_id}`}
                                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-[var(--color-surface-card)] hover:shadow-md transition-shadow"
                              >
                                <img
                                  src={item.thumbnail_url || item.url}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="text-xs text-white font-medium truncate">{item.title}</p>
                                  <p className="text-[10px] text-white/70 truncate">{item.author}</p>
                                </div>
                                {/* 下载信息角标 */}
                                <div className="absolute top-2 right-2">
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded-full">
                                    <Download className="w-2.5 h-2.5" />
                                    {item.resolution || "原图"}
                                  </span>
                                </div>
                              </Link>
                            ))}
                          </div>
                          {/* 分页 */}
                          {downloadTotal > 12 && (
                            <div className="flex items-center justify-center gap-4 mt-6">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadPage <= 1}
                                onClick={() => setDownloadPage((p) => Math.max(1, p - 1))}
                                className="rounded-full gap-1"
                              >
                                <ChevronLeft className="w-4 h-4" />
                                上一页
                              </Button>
                              <span className="text-sm text-[var(--color-mute)]">
                                {downloadPage} / {Math.ceil(downloadTotal / 12)}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadPage >= Math.ceil(downloadTotal / 12)}
                                onClick={() => setDownloadPage((p) => p + 1)}
                                className="rounded-full gap-1"
                              >
                                下一页
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Download className="w-10 h-10 text-[var(--color-ash)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-mute)] mb-3">还没有下载过任何壁纸</p>
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

                  {/* Uploads Tab */}
                  <TabsContent value="uploads">
                    <div className="mt-4">
                      {/* Storage Quota Bar */}
                      <StorageQuotaBar />
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
                                    className="p-1 rounded-full bg-red-500/80 hover:bg-red-600 dark:bg-red-600/80 dark:hover:bg-red-700 transition-colors"
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

                  {/* Achievements Tab */}
                  <TabsContent value="achievements">
                    <div className="mt-4">
                      {loadingLevel ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-24 rounded-xl skeleton-pulse bg-[var(--color-surface-card)]" />
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-[var(--color-mute)]">
                              已解锁 {achievements.filter((a) => a.unlocked).length} / {achievements.length} 个成就
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {achievements.map((ach) => (
                              <AchievementCard
                                key={ach.id}
                                name={ach.name}
                                description={ach.description}
                                icon={ach.icon}
                                unlocked={ach.unlocked}
                                unlockedAt={ach.unlockedAt}
                                progress={ach.progress}
                                expReward={ach.expReward}
                                currentValue={ach.currentValue}
                                conditionValue={ach.conditionValue}
                              />
                            ))}
                          </div>
                        </>
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
                      className="rounded-full bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 gap-1"
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
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                          <span className="font-medium text-emerald-700">创建成功</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-sm break-all relative">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(newKeyResult.key);
                              setCopiedKey(true);
                              setTimeout(() => setCopiedKey(false), 2000);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[var(--color-surface-card)]"
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
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
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
                      <div>
                        <Label className="mb-1.5 block">有效期</Label>
                        <select
                          value={newKeyExpiry}
                          onChange={(e) => setNewKeyExpiry(parseInt(e.target.value))}
                          className="w-full rounded-xl border border-[var(--color-hairline)] bg-transparent px-3 py-2 text-sm"
                        >
                          <option value={30}>30 天</option>
                          <option value={60}>60 天</option>
                          <option value={90}>90 天（默认）</option>
                          <option value={180}>180 天</option>
                          <option value={365}>1 年</option>
                          <option value={0}>永不过期</option>
                        </select>
                        <p className="text-xs text-[var(--color-mute)] mt-1">Key 过期后将自动禁用，0 表示永不过期</p>
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
                              const csrfHeaders = await withCsrfHeader();
                              const res = await fetch("/api/api-keys", {
                                method: "POST",
                                headers: { "Content-Type": "application/json", ...csrfHeaders },
                                body: JSON.stringify({ name: newKeyName, rate_limit: newKeyLimit, expires_in_days: newKeyExpiry }),
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
                          const csrfHeaders = await withCsrfHeader();
                          const res = await fetch(`/api/api-keys/${deleteKeyTarget.id}`, {
                            method: "DELETE",
                            headers: { ...csrfHeaders },
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
                      className="rounded-full bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 gap-1"
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

              {/* Profile Customization Dialog */}
              <ProfileCustomizationDialog
                open={profileCustomOpen}
                onOpenChange={setProfileCustomOpen}
                initialBio={bio}
                initialSocialLinks={socialLinks}
                initialFeaturedCollections={featuredCollections}
                collections={myCollections}
                userId={user.id}
                onSaveSuccess={() => {
                  // 重新加载定制数据以同步
                  fetch("/api/user/profile-customization")
                    .then((res) => { if (!res.ok) return null; return res.json(); })
                    .then((data) => {
                      if (data) {
                        setBio(data.bio || "");
                        setSocialLinks(data.social_links || {});
                        setFeaturedCollections(data.featured_collections || []);
                      }
                    })
                    .catch(() => {});
                }}
              />

              {/* Email Preference Dialog */}
              <EmailPreferenceDialog
                open={emailPrefOpen}
                onOpenChange={setEmailPrefOpen}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}