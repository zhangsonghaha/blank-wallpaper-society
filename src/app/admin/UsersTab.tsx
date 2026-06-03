"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Ban,
  Unlock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  UserCog,
  Image as ImageIcon,
  Heart,
  Calendar,
  MoreHorizontal,
  Clock,
  Palette,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { withCsrfHeader } from "@/lib/csrf-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/* ==================== 类型定义 ==================== */

interface UserRecord {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  status: string;
  banned_reason: string | null;
  banned_at: string | null;
  created_at: string;
  updated_at: string;
  upload_count: number;
  favorite_count: number;
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
}

interface UserDetail extends UserRecord {
  recentImages: any[];
  operationLogs: any[];
}

/* ==================== 常量 ==================== */

const ROLE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  admin: { label: "管理员", color: "#DC2626", bgColor: "#FEE2E2", icon: ShieldAlert },
  moderator: { label: "审核员", color: "#7C3AED", bgColor: "#EDE9FE", icon: ShieldCheck },
  creator: { label: "创作者", color: "#059669", bgColor: "#D1FAE5", icon: Palette },
  user: { label: "用户", color: "#2563EB", bgColor: "#DBEAFE", icon: Users },
};

const ROLE_OPTIONS = [
  { value: "user", label: "普通用户" },
  { value: "creator", label: "创作者" },
  { value: "moderator", label: "审核员" },
  { value: "admin", label: "管理员" },
];

/* ==================== 工具函数 ==================== */

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateShort = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
};

/* ==================== 角色徽章组件 ==================== */

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  const Icon = config.icon;
  return (
    <Badge
      className="rounded-full gap-1 font-medium border-0 relative dark:after:absolute dark:after:inset-0 dark:after:rounded-full dark:after:bg-black/50"
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      <Icon className="w-3 h-3 relative z-10" />
      <span className="relative z-10">{config.label}</span>
    </Badge>
  );
}

/* ==================== 状态徽章组件 ==================== */

function StatusBadge({ status }: { status: string }) {
  if (status === "banned" || status === "suspended") {
    return (
      <Badge className="rounded-full gap-1 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-0 font-medium">
        <Ban className="w-3 h-3" />
        {status === "suspended" ? "已停用" : "已封禁"}
      </Badge>
    );
  }
  if (status === "pending_deletion") {
    return (
      <Badge className="rounded-full gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-0 font-medium">
        <Clock className="w-3 h-3" />
        待注销
      </Badge>
    );
  }
  if (status === "deleted") {
    return (
      <Badge className="rounded-full gap-1 bg-[var(--color-surface-card)] text-[var(--color-mute)] border-0 font-medium">
        <Trash2 className="w-3 h-3" />
        已注销
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full gap-1 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-0 font-medium">
      <Unlock className="w-3 h-3" />
      正常
    </Badge>
  );
}

/* ==================== 主组件 ==================== */

export default function UsersTab() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  // 用户详情
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<UserDetail | null>(null);

  // 角色修改弹窗
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<UserRecord | null>(null);
  const [newRole, setNewRole] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);

  // 封禁弹窗
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<UserRecord | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banSaving, setBanSaving] = useState(false);

  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // 重置密码弹窗
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<UserRecord | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState("");
  const [resetPwdSaving, setResetPwdSaving] = useState(false);

  // 统计
  const [userStats, setUserStats] = useState({
    total: 0,
    active: 0,
    banned: 0,
    admins: 0,
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();

      setUsers(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);

      // 计算统计（使用总数即可，详细统计用列表数据估算）
      setUserStats({
        total: data.total || 0,
        active: (data.data || []).filter((u: UserRecord) => u.status === "active").length,
        banned: (data.data || []).filter((u: UserRecord) => u.status === "banned" || u.status === "suspended").length,
        admins: (data.data || []).filter((u: UserRecord) => u.role === "admin").length,
      });
    } catch (err) {
      console.error("加载用户列表失败:", err);
      toast.error("加载用户列表失败");
    }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 查看用户详情
  const openDetail = async (user: UserRecord) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`);
      if (!res.ok) throw new Error("获取失败");
      const data = await res.json();
      setDetailUser(data);
    } catch (err) {
      toast.error("获取用户详情失败");
      setDetailOpen(false);
    }
    setDetailLoading(false);
  };

  // 修改角色
  const handleRoleChange = async () => {
    if (!roleTarget || !newRole) return;
    setRoleSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/users/${roleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("角色修改成功", {
          description: `${roleTarget.name} 的角色已更新为 ${ROLE_CONFIG[newRole]?.label || newRole}`,
        });
        setRoleDialogOpen(false);
        loadUsers();
      } else {
        toast.error("修改失败", { description: data.error });
      }
    } catch (err) {
      toast.error("修改失败");
    }
    setRoleSaving(false);
  };

  // 封禁用户
  const handleBan = async () => {
    if (!banTarget) return;
    setBanSaving(true);
    try {
      const isBanned = banTarget.status === "banned" || banTarget.status === "suspended";
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/users/${banTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          status: isBanned ? "active" : "suspended",
          bannedReason: banReason || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          isBanned ? "已解封用户" : "已封禁用户",
          {
            description: isBanned
              ? `${banTarget.name} 已解封`
              : `${banTarget.name} 已被封禁`,
          }
        );
        setBanDialogOpen(false);
        setBanReason("");
        loadUsers();
      } else {
        toast.error("操作失败", { description: data.error });
      }
    } catch (err) {
      toast.error("操作失败");
    }
    setBanSaving(false);
  };

  // 删除用户
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/users/${deleteTarget.id}/account-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          reason: `管理员删除用户 ${deleteTarget.name}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("用户已删除", {
          description: `${deleteTarget.name} 已被删除`,
        });
        setDeleteDialogOpen(false);
        setDetailOpen(false);
        loadUsers();
      } else {
        toast.error("删除失败", { description: data.error });
      }
    } catch (err) {
      toast.error("删除失败");
    }
    setDeleteSaving(false);
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!resetPwdTarget || !resetPwdValue) return;
    if (resetPwdValue.length < 6) {
      toast.error("密码至少6位");
      return;
    }
    setResetPwdSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/users/${resetPwdTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ resetPassword: resetPwdValue }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("密码重置成功", {
          description: `${resetPwdTarget.name} 的密码已重置`,
        });
        setResetPwdDialogOpen(false);
        setResetPwdValue("");
        loadUsers();
      } else {
        toast.error("重置失败", { description: data.error });
      }
    } catch (err) {
      toast.error("重置失败");
    }
    setResetPwdSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">用户总数</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : total}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">活跃用户</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : userStats.active}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">已封禁</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : userStats.banned}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">管理员</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : userStats.admins}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              用户管理
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
                <Input
                  placeholder="搜索用户名或邮箱..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 rounded-full text-sm"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  if (v) setRoleFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-9 rounded-full text-sm">
                  <SelectValue placeholder="全部角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="moderator">审核员</SelectItem>
                  <SelectItem value="creator">创作者</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  if (v) setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-9 rounded-full text-sm">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="suspended">已停用</SelectItem>
                  <SelectItem value="banned">已封禁</SelectItem>
                  <SelectItem value="pending_deletion">待注销</SelectItem>
                  <SelectItem value="deleted">已注销</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
                <Users className="w-8 h-8 text-[var(--color-ash)]" />
              </div>
              <h3 className="text-lg font-semibold mb-1">暂无用户</h3>
              <p className="text-sm text-[var(--color-mute)]">
                没有找到匹配的用户
              </p>
            </div>
          ) : (
            <>
              {/* 用户卡片列表 */}
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-hairline-soft)] hover:bg-[var(--color-surface-soft)] transition-colors cursor-pointer group"
                    onClick={() => openDetail(user)}
                  >
                    {/* 头像 */}
                    <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
                          <span className="text-sm font-bold text-blue-600">
                            {user.name?.charAt(0)?.toUpperCase() || "U"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 用户信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[var(--color-ink)] truncate">
                          {user.name}
                        </span>
                        <RoleBadge role={user.role} />
                        <StatusBadge status={user.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--color-mute)]">
                        <span>{user.email}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateShort(user.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* 统计 */}
                    <div className="hidden sm:flex items-center gap-4 text-sm text-[var(--color-mute)]">
                      <span className="flex items-center gap-1" title="上传数">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {user.upload_count}
                      </span>
                      <span className="flex items-center gap-1" title="收藏数">
                        <Heart className="w-3.5 h-3.5" />
                        {user.favorite_count}
                      </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {user.role !== "admin" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8"
                            title="修改角色"
                            onClick={() => {
                              setRoleTarget(user);
                              setNewRole(user.role);
                              setRoleDialogOpen(true);
                            }}
                          >
                            <Shield className="w-4 h-4 text-[var(--color-mute)]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8"
                            title={user.status === "suspended" || user.status === "banned" ? "解封" : "封禁"}
                            onClick={() => {
                              setBanTarget(user);
                              setBanReason("");
                              setBanDialogOpen(true);
                            }}
                          >
                            {user.status === "suspended" || user.status === "banned" ? (
                              <Unlock className="w-4 h-4 text-green-600" />
                            ) : (
                              <Ban className="w-4 h-4 text-[var(--color-mute)]" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="outline-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-card)] transition-colors">
                              <MoreHorizontal className="w-4 h-4 text-[var(--color-mute)]" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => openDetail(user)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setResetPwdTarget(user);
                                  setResetPwdValue("");
                                  setResetPwdDialogOpen(true);
                                }}
                              >
                                <KeyRound className="w-4 h-4 mr-2" />
                                重置密码
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-500 cursor-pointer"
                                onClick={() => {
                                  setDeleteTarget(user);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除用户
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-[var(--color-mute)]">
                  共 {total} 个用户，第 {page}/{totalPages} 页
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-full"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ==================== 用户详情弹窗 ==================== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-4 w-64" />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            </div>
          ) : detailUser ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
                    {detailUser.avatar ? (
                      <img
                        src={detailUser.avatar}
                        alt={detailUser.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30">
                        <span className="text-lg font-bold text-blue-600">
                          {detailUser.name?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-xl">
                      {detailUser.name}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <RoleBadge role={detailUser.role} />
                      <StatusBadge status={detailUser.status} />
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* 基本信息网格 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4">
                <div className="p-3 rounded-xl bg-[var(--color-surface-soft)]">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> 上传数
                  </p>
                  <p className="text-lg font-bold mt-1">{detailUser.upload_count}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-surface-soft)]">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <Heart className="w-3 h-3" /> 收藏数
                  </p>
                  <p className="text-lg font-bold mt-1">{detailUser.favorite_count}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-surface-soft)]">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 注册时间
                  </p>
                  <p className="text-sm font-medium mt-1">{formatDate(detailUser.created_at)}</p>
                </div>
                <div className="p-3 rounded-xl bg-[var(--color-surface-soft)]">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 最近更新
                  </p>
                  <p className="text-sm font-medium mt-1">{formatDate(detailUser.updated_at)}</p>
                </div>
              </div>

              {/* 邮箱 */}
              <div className="py-2">
                <p className="text-xs text-[var(--color-mute)]">邮箱</p>
                <p className="text-sm font-medium">{detailUser.email}</p>
              </div>

              {/* 封禁信息 */}
              {(detailUser.status === "banned" || detailUser.status === "suspended") && detailUser.banned_reason && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/10 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <Ban className="w-3 h-3" /> 封禁原因
                  </p>
                  <p className="text-sm text-red-800 mt-1">{detailUser.banned_reason}</p>
                  {detailUser.banned_at && (
                    <p className="text-xs text-red-500 mt-1">
                      封禁时间: {formatDate(detailUser.banned_at)}
                    </p>
                  )}
                </div>
              )}

              <Separator />

              {/* 最近上传 */}
              {detailUser.recentImages && detailUser.recentImages.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)] mb-2 flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" /> 最近上传
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {detailUser.recentImages.map((img: any) => (
                      <div
                        key={img.id}
                        className="aspect-square rounded-lg overflow-hidden bg-[var(--color-surface-card)]"
                      >
                        <img
                          src={img.thumbnail_url || img.url}
                          alt={img.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 操作日志 */}
              {detailUser.operationLogs && detailUser.operationLogs.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)] mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> 操作记录
                  </p>
                  <div className="space-y-2">
                    {detailUser.operationLogs.map((log: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs p-2 rounded-lg bg-[var(--color-surface-soft)]"
                      >
                        <Badge variant="secondary" className="rounded-full text-[10px] px-1.5 py-0">
                          {log.operation === "change_role" ? "角色变更" :
                           log.operation === "ban_user" ? "封禁" :
                           log.operation === "unban_user" ? "解封" :
                           log.operation === "delete_user" ? "删除" :
                           log.operation === "reset_password" ? "重置密码" : log.operation}
                        </Badge>
                        <span className="text-[var(--color-mute)]">
                          由 {log.operator_name || "系统"} 操作
                        </span>
                        <span className="text-[var(--color-ash)] ml-auto">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 底部操作 */}
              {detailUser.role !== "admin" && (
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="rounded-full gap-1"
                    onClick={() => {
                      setRoleTarget(detailUser as any);
                      setNewRole(detailUser.role);
                      setRoleDialogOpen(true);
                    }}
                  >
                    <Shield className="w-4 h-4" />
                    修改角色
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full gap-1"
                    onClick={() => {
                      setResetPwdTarget(detailUser as any);
                      setResetPwdValue("");
                      setResetPwdDialogOpen(true);
                    }}
                  >
                    <KeyRound className="w-4 h-4" />
                    重置密码
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full gap-1"
                    onClick={() => {
                      setBanTarget(detailUser as any);
                      setBanReason("");
                      setBanDialogOpen(true);
                    }}
                  >
                    {detailUser.status === "banned" || detailUser.status === "suspended" ? (
                      <>
                        <Unlock className="w-4 h-4" />
                        解封
                      </>
                    ) : (
                      <>
                        <Ban className="w-4 h-4" />
                        封禁
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-full gap-1 ml-auto"
                    onClick={() => {
                      setDeleteTarget(detailUser as any);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    删除用户
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ==================== 角色修改弹窗 ==================== */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--color-primary)]" />
              修改用户角色
            </DialogTitle>
            <DialogDescription>
              将 {roleTarget?.name} 的角色从{" "}
              <span className="font-medium">
                {ROLE_CONFIG[roleTarget?.role || "user"]?.label}
              </span>{" "}
              修改为：
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>选择新角色</Label>
            <Select value={newRole} onValueChange={(v) => v && setNewRole(v)}>
              <SelectTrigger className="mt-2 h-10 rounded-xl">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--color-mute)] mt-2">
              角色变更将记录到操作日志中
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              disabled={roleSaving || !newRole || newRole === roleTarget?.role}
              onClick={handleRoleChange}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
            >
              {roleSaving ? "保存中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 封禁弹窗 ==================== */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {banTarget?.status === "suspended" || banTarget?.status === "banned" ? (
                <Unlock className="w-5 h-5 text-green-600" />
              ) : (
                <Ban className="w-5 h-5 text-[var(--color-primary)]" />
              )}
              {banTarget?.status === "suspended" || banTarget?.status === "banned" ? "解封用户" : "封禁用户"}
            </DialogTitle>
            <DialogDescription>
              {banTarget?.status === "suspended" || banTarget?.status === "banned"
                ? `确定要解封用户 ${banTarget?.name} 吗？`
                : `确定要封禁用户 ${banTarget?.name} 吗？`}
            </DialogDescription>
          </DialogHeader>
          {banTarget?.status !== "banned" && banTarget?.status !== "suspended" && (
            <div className="py-4">
              <Label>封禁原因</Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="请输入封禁原因（必填）"
                className="mt-2 h-24 rounded-xl resize-none"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBanDialogOpen(false);
                setBanReason("");
              }}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              disabled={banSaving || (banTarget?.status !== "banned" && banTarget?.status !== "suspended" && !banReason.trim())}
              onClick={handleBan}
              className={
                banTarget?.status === "banned" || banTarget?.status === "suspended"
                  ? "bg-green-600 hover:bg-green-700 rounded-full gap-2"
                  : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
              }
            >
              {banSaving
                ? "处理中..."
                : banTarget?.status === "banned" || banTarget?.status === "suspended"
                  ? "确认解封"
                  : "确认封禁"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 删除确认弹窗 ==================== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              删除用户
            </DialogTitle>
            <DialogDescription>
              确定要删除用户 <span className="font-semibold">{deleteTarget?.name}</span> 吗？
              此操作将匿名化该用户信息，不可恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 dark:bg-red-900/10 dark:border-red-800 dark:text-red-300">
            <p className="font-medium">注意：</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
              <li>用户昵称、邮箱、头像将被清除</li>
              <li>用户收藏、评论、关注等数据将被删除</li>
              <li>用户已上传的图片不会被删除</li>
              <li>账号状态将标记为已注销</li>
              <li>此操作将记录到管理日志</li>
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSaving}
              onClick={handleDelete}
              className="rounded-full gap-2"
            >
              {deleteSaving ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== 重置密码弹窗 ==================== */}
      <Dialog open={resetPwdDialogOpen} onOpenChange={setResetPwdDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[var(--color-primary)]" />
              重置用户密码
            </DialogTitle>
            <DialogDescription>
              为用户 <span className="font-semibold">{resetPwdTarget?.name}</span> 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div>
              <Label>新密码</Label>
              <Input
                type="password"
                value={resetPwdValue}
                onChange={(e) => setResetPwdValue(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                className="mt-2 h-10 rounded-xl"
                minLength={6}
              />
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-300">
              <p className="font-medium">注意：</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                <li>重置后用户需要使用新密码登录</li>
                <li>密码长度至少6位</li>
                <li>此操作将记录到管理日志</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPwdDialogOpen(false);
                setResetPwdValue("");
              }}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              disabled={resetPwdSaving || resetPwdValue.length < 6}
              onClick={handleResetPassword}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
            >
              {resetPwdSaving ? "重置中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}