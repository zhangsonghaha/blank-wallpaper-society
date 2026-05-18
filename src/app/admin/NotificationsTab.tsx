"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Bell,
  BellOff,
  Send,
  Trash2,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronRight,
  Users,
  Megaphone,
  Heart,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  Filter,
  CheckCheck,
  X,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/* ==================== 类型定义 ==================== */

interface NotificationRecord {
  id: number;
  user_id: number;
  type: string;
  title: string;
  content: string | null;
  related_id: number | null;
  related_type: string | null;
  is_read: number;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

interface TypeDistItem {
  type: string;
  count: number;
}

/* ==================== 配置 ==================== */

const typeConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  system: { label: "系统通知", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", icon: Megaphone },
  like: { label: "收藏", color: "text-rose-700", bgColor: "bg-rose-50 border-rose-200", icon: Heart },
  comment: { label: "评论", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200", icon: MessageSquare },
  review: { label: "审核", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200", icon: ShieldCheck },
  follow: { label: "关注", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: UserPlus },
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* ==================== 通知管理组件 ==================== */

export default function NotificationsTab() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState("all");
  const [typeDist, setTypeDist] = useState<TypeDistItem[]>([]);

  // 发送通知
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendForm, setSendForm] = useState({
    title: "",
    content: "",
    type: "system",
    target: "all", // all | specific
    userIds: [] as number[],
    userEmail: "",
    sendMode: "both", // notification | email | both
  });

  // 用户搜索
  const [userSearchResults, setUserSearchResults] = useState<{ id: number; name: string; email: string }[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const limit = 15;

  /* ==================== 数据加载 ==================== */

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (typeFilter !== "all") params.set("type", typeFilter);

      const res = await fetch(`/api/admin/notifications?${params}`);
      if (!res.ok) throw new Error("获取数据失败");
      const data = await res.json();

      setNotifications(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setUnreadCount(data.unreadCount || 0);
      setTypeDist(data.typeDistribution || []);
    } catch (err) {
      console.error("加载通知列表失败:", err);
      toast.error("加载通知列表失败");
    }
    setLoading(false);
  }, [page, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ==================== 发送通知 ==================== */

  const handleSend = async () => {
    if (!sendForm.title.trim()) {
      toast.error("请输入通知标题");
      return;
    }

    setSending(true);
    try {
      let userIds: number[] = [];

      if (sendForm.target === "all") {
        // 获取所有用户ID
        const res = await fetch("/api/admin/users?page=1&limit=1000");
        if (res.ok) {
          const data = await res.json();
          userIds = (data.users || data.data || []).map((u: any) => u.id);
        }
        if (userIds.length === 0) {
          toast.error("未找到用户");
          setSending(false);
          return;
        }
      } else {
        userIds = sendForm.userIds;
        if (userIds.length === 0) {
          toast.error("请添加接收通知的用户");
          setSending(false);
          return;
        }
      }

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          userIds,
          title: sendForm.title.trim(),
          content: sendForm.content.trim() || null,
          type: sendForm.type,
          sendMode: sendForm.sendMode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("发送成功", { description: data.message });
        setSendDialogOpen(false);
        setSendForm({
          title: "",
          content: "",
          type: "system",
          target: "all",
          userIds: [],
          userEmail: "",
          sendMode: "both",
        });
        loadData();
      } else {
        toast.error("发送失败", { description: data.error });
      }
    } catch {
      toast.error("发送失败");
    }
    setSending(false);
  };

  const searchUsers = async (email: string) => {
    if (!email.trim() || email.length < 2) {
      setUserSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(email)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const users = data.users || data.data || [];
        setUserSearchResults(
          users.map((u: any) => ({ id: u.id, name: u.name, email: u.email }))
        );
      }
    } catch {
      // 静默
    }
    setSearchingUsers(false);
  };

  const addUser = (user: { id: number; name: string; email: string }) => {
    if (sendForm.userIds.includes(user.id)) {
      toast.error("该用户已在列表中");
      return;
    }
    setSendForm((prev) => ({
      ...prev,
      userIds: [...prev.userIds, user.id],
      userEmail: "",
    }));
    setUserSearchResults([]);
  };

  const removeUser = (id: number) => {
    setSendForm((prev) => ({
      ...prev,
      userIds: prev.userIds.filter((uid) => uid !== id),
    }));
  };

  /* ==================== 删除通知 ==================== */

  const handleDelete = async (id: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/notifications?id=${id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("删除成功");
        loadData();
      } else {
        toast.error("删除失败", { description: data.error });
      }
    } catch {
      toast.error("删除失败");
    }
  };

  /* ==================== 渲染 ==================== */

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">通知总数</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : total}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">未读</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : unreadCount}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <MailOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">已读</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : total - unreadCount}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">类型数</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : typeDist.length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 通知列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>通知列表</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={(v) => { if (v) { setTypeFilter(v); setPage(1); } }}>
                <SelectTrigger className="w-32 h-9 rounded-full text-sm">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(typeConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setSendDialogOpen(true)} size="sm" className="rounded-full">
                <Send className="w-4 h-4 mr-1" />
                发送通知
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 类型分布标签 */}
          {typeDist.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {typeDist.map((item) => {
                const cfg = typeConfig[item.type];
                return (
                  <Badge
                    key={item.type}
                    variant="outline"
                    className="rounded-full text-xs cursor-pointer hover:bg-[var(--color-surface-soft)]"
                    onClick={() => { setTypeFilter(item.type); setPage(1); }}
                  >
                    {cfg?.icon && <cfg.icon className="w-3 h-3 mr-1" />}
                    {cfg?.label || item.type}: {item.count}
                  </Badge>
                );
              })}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
                <BellOff className="w-8 h-8 text-[var(--color-ash)]" />
              </div>
              <h3 className="text-lg font-semibold mb-1">暂无通知</h3>
              <p className="text-sm text-[var(--color-mute)]">
                点击「发送通知」按钮向用户发送通知
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {notifications.map((notif) => {
                  const cfg = typeConfig[notif.type] || typeConfig.system;
                  const TypeIcon = cfg.icon;
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                        notif.is_read
                          ? "bg-transparent"
                          : "bg-blue-50/50 border-blue-100"
                      } hover:bg-[var(--color-surface-soft)]`}
                    >
                      {/* 类型图标 */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bgColor.split(" ")[0]}`}>
                        <TypeIcon className={`w-4 h-4 ${cfg.color}`} />
                      </div>

                      {/* 通知内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${!notif.is_read ? "text-[var(--color-ink)]" : "text-[var(--color-mute)]"}`}>
                            {notif.title}
                          </span>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        {notif.content && (
                          <p className="text-xs text-[var(--color-mute)] mt-0.5 line-clamp-2">
                            {notif.content}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-[var(--color-ash)]">
                            {notif.user_name || notif.user_email || "未知用户"}
                          </span>
                          <Badge variant="outline" className={`rounded-full text-[10px] ${cfg.color} ${cfg.bgColor} border-0`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-[var(--color-ash)]">
                            {formatDate(notif.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* 操作 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => handleDelete(notif.id)}
                      >
                        <Trash2 className="w-4 h-4 text-[var(--color-ash)] hover:text-red-500" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-[var(--color-mute)]">
                  共 {total} 条通知，第 {page}/{totalPages} 页
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

      {/* 发送通知对话框 */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle>发送通知</DialogTitle>
            <DialogDescription>
              向用户发送系统通知，支持群发。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>通知类型</Label>
              <Select value={sendForm.type} onValueChange={(v) => { if (v) setSendForm((p) => ({ ...p, type: v })); }}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">系统通知</SelectItem>
                  <SelectItem value="review">审核通知</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-title">通知标题</Label>
              <Input
                id="notif-title"
                placeholder="输入通知标题"
                value={sendForm.title}
                onChange={(e) => setSendForm((p) => ({ ...p, title: e.target.value }))}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-content">通知内容</Label>
              <Textarea
                id="notif-content"
                placeholder="输入通知内容（可选）"
                value={sendForm.content}
                onChange={(e) => setSendForm((p) => ({ ...p, content: e.target.value }))}
                className="rounded-lg min-h-[80px]"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>发送方式</Label>
              <Select value={sendForm.sendMode} onValueChange={(v) => { if (v) setSendForm((p) => ({ ...p, sendMode: v })); }}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notification">仅站内通知</SelectItem>
                  <SelectItem value="email">仅邮件通知</SelectItem>
                  <SelectItem value="both">站内通知 + 邮件</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>发送对象</Label>
              <Select value={sendForm.target} onValueChange={(v) => { if (v) setSendForm((p) => ({ ...p, target: v, userIds: [] })); }}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有用户</SelectItem>
                  <SelectItem value="specific">指定用户</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sendForm.target === "specific" && (
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="输入邮箱搜索用户..."
                    value={sendForm.userEmail}
                    onChange={(e) => {
                      setSendForm((p) => ({ ...p, userEmail: e.target.value }));
                      searchUsers(e.target.value);
                    }}
                    className="rounded-lg"
                  />
                  {searchingUsers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-[var(--color-ash)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {userSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-auto">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-soft)] transition-colors"
                          onClick={() => addUser(user)}
                        >
                          <span className="font-medium">{user.name}</span>
                          <span className="text-[var(--color-ash)] ml-2 text-xs">{user.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {sendForm.userIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {sendForm.userIds.map((uid) => {
                      const user = userSearchResults.find((u) => u.id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="rounded-full text-xs">
                          {user?.name || `用户${uid}`}
                          <button
                            className="ml-1 hover:text-red-500"
                            onClick={() => removeUser(uid)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} className="rounded-full">
              取消
            </Button>
            <Button onClick={handleSend} disabled={sending} className="rounded-full">
              <Send className="w-4 h-4 mr-1" />
              {sending ? "发送中..." : "发送通知"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}