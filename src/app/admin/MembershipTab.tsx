"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Crown,
  Search,
  RefreshCw,
  Plus,
  Ticket,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Gift,
  Ban,
  Trash2,
  Eye,
  Bell,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";

/* ==================== 类型定义 ==================== */

interface MembershipStats {
  activeCount: number;
  expiringCount: number;
  totalMembers: number;
  planDistribution: { plan: string; count: number }[];
}

interface MembershipRecord {
  id: number;
  user_id: number;
  plan: string;
  started_at: string;
  expires_at: string;
  status: string;
  source: string;
  granted_by: number | null;
  granter_name: string | null;
  user_name: string;
  user_email: string;
  user_avatar: string | null;
  created_at: string;
}

interface RedeemCode {
  id: number;
  code: string;
  plan: string;
  duration_days: number;
  max_uses: number;
  used_count: number;
  created_by: number;
  creator_name: string;
  batch_name: string | null;
  note: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
}

/* ==================== 常量 ==================== */

const PLAN_LABELS: Record<string, string> = {
  monthly: "月度会员",
  yearly: "年度会员",
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  payment: { label: "支付购买", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  admin_grant: { label: "管理员发放", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" },
  redeem_code: { label: "兑换码", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  active: { label: "生效中", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  expired: { label: "已过期", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
};

const CODE_STATUS_STYLES: Record<string, { label: string; color: string }> = {
  active: { label: "可用", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  disabled: { label: "已禁用", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  expired: { label: "已过期", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
};

/* ==================== 工具函数 ==================== */

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDaysLeft = (dateStr: string) => {
  if (!dateStr) return 0;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

/* ==================== 主组件 ==================== */

export default function MembershipTab() {
  const [activeSection, setActiveSection] = useState<"stats" | "members" | "codes" | "expiring">("stats");

  return (
    <div className="space-y-4">
      {/* 顶部导航 */}
      <div className="flex gap-2 border-b pb-3">
        {[
          { key: "stats" as const, label: "概览统计", icon: BarChart3 },
          { key: "members" as const, label: "会员列表", icon: Users },
          { key: "codes" as const, label: "兑换码管理", icon: Ticket },
          { key: "expiring" as const, label: "到期监控", icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeSection === key ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection(key)}
          >
            <Icon className="w-4 h-4 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {activeSection === "stats" && <StatsSection />}
      {activeSection === "members" && <MembersSection />}
      {activeSection === "codes" && <RedeemCodesSection />}
      {activeSection === "expiring" && <ExpiringSection />}
    </div>
  );
}

/* ==================== 概览统计 ==================== */

function StatsSection() {
  const [stats, setStats] = useState<MembershipStats | null>(null);
  const [recentGrants, setRecentGrants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/membership?action=stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentGrants(data.recentGrants || []);
      }
    } catch (err) {
      toast.error("加载统计失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">活跃会员</CardTitle>
            <Crown className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeCount || 0}</div>
            <p className="text-xs text-muted-foreground">当前有效会员总数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">即将到期</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.expiringCount || 0}</div>
            <p className="text-xs text-muted-foreground">7天内到期</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">累计会员</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
            <p className="text-xs text-muted-foreground">含已过期</p>
          </CardContent>
        </Card>
      </div>

      {/* 套餐分布 */}
      <Card>
        <CardHeader><CardTitle className="text-base">套餐分布</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {(stats?.planDistribution || []).map((p) => (
              <div key={p.plan} className="flex items-center gap-2">
                <Badge variant="outline">{PLAN_LABELS[p.plan] || p.plan}</Badge>
                <span className="font-medium">{p.count}</span>
              </div>
            ))}
            {(!stats?.planDistribution || stats.planDistribution.length === 0) && (
              <span className="text-muted-foreground text-sm">暂无数据</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 最近发放记录 */}
      <Card>
        <CardHeader><CardTitle className="text-base">最近发放/兑换记录</CardTitle></CardHeader>
        <CardContent>
          {recentGrants.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无记录</p>
          ) : (
            <div className="space-y-2">
              {recentGrants.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={SOURCE_LABELS[r.source]?.color || "bg-gray-100"}>
                      {SOURCE_LABELS[r.source]?.label || r.source}
                    </Badge>
                    <span>{r.user_name}</span>
                    <span className="text-muted-foreground">{PLAN_LABELS[r.plan]}</span>
                  </div>
                  <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ==================== 会员列表 ==================== */

function MembersSection() {
  const [members, setMembers] = useState<MembershipRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 发放会员弹窗
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantForm, setGrantForm] = useState({ userId: "", plan: "monthly", durationDays: "", note: "" });

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: "members", page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (planFilter) params.set("plan", planFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/membership?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      toast.error("加载会员列表失败");
    }
    setLoading(false);
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleGrant = async () => {
    setGrantSaving(true);
    try {
      const res = await fetch("/api/admin/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({
          userId: parseInt(grantForm.userId),
          plan: grantForm.plan,
          durationDays: grantForm.durationDays ? parseInt(grantForm.durationDays) : undefined,
          note: grantForm.note || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("会员发放成功");
        setGrantOpen(false);
        setGrantForm({ userId: "", plan: "monthly", durationDays: "", note: "" });
        loadMembers();
      } else {
        toast.error(data.error || "发放失败");
      }
    } catch (err) {
      toast.error("发放失败");
    }
    setGrantSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Input
            placeholder="搜索用户名/邮箱"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-48"
          />
          <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v === "all" ? "" : (v ?? "")); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="套餐" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部套餐</SelectItem>
              <SelectItem value="monthly">月度</SelectItem>
              <SelectItem value="yearly">年度</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : (v ?? "")); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">生效中</SelectItem>
              <SelectItem value="expired">已过期</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setGrantOpen(true)}>
          <Gift className="w-4 h-4 mr-1" />
          发放会员
        </Button>
      </div>

      {/* 会员列表 */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">用户</th>
                <th className="text-left p-3">套餐</th>
                <th className="text-left p-3">来源</th>
                <th className="text-left p-3">生效时间</th>
                <th className="text-left p-3">到期时间</th>
                <th className="text-left p-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const daysLeft = getDaysLeft(m.expires_at);
                return (
                  <tr key={m.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{m.user_name}</div>
                      <div className="text-xs text-muted-foreground">{m.user_email}</div>
                    </td>
                    <td className="p-3">{PLAN_LABELS[m.plan] || m.plan}</td>
                    <td className="p-3">
                      <Badge className={SOURCE_LABELS[m.source]?.color || "bg-gray-100"}>
                        {SOURCE_LABELS[m.source]?.label || m.source}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">{formatDate(m.started_at)}</td>
                    <td className="p-3">
                      <div className="text-xs">{formatDate(m.expires_at)}</div>
                      {m.status === "active" && daysLeft <= 7 && daysLeft > 0 && (
                        <div className="text-xs text-amber-600">剩余{daysLeft}天</div>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge className={STATUS_STYLES[m.status]?.color || "bg-gray-100"}>
                        {STATUS_STYLES[m.status]?.label || m.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">暂无会员数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 发放会员弹窗 */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发放会员</DialogTitle>
            <DialogDescription>给指定用户直接发放会员权益</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>用户ID</Label>
              <Input
                placeholder="输入用户ID"
                value={grantForm.userId}
                onChange={(e) => setGrantForm(f => ({ ...f, userId: e.target.value }))}
              />
            </div>
            <div>
              <Label>会员套餐</Label>
              <Select value={grantForm.plan} onValueChange={(v) => setGrantForm(f => ({ ...f, plan: v ?? "monthly" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">月度会员（30天）</SelectItem>
                  <SelectItem value="yearly">年度会员（365天）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>自定义天数（留空使用默认）</Label>
              <Input
                type="number"
                placeholder="如：60"
                value={grantForm.durationDays}
                onChange={(e) => setGrantForm(f => ({ ...f, durationDays: e.target.value }))}
              />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea
                placeholder="发放原因说明"
                value={grantForm.note}
                onChange={(e) => setGrantForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>取消</Button>
            <Button onClick={handleGrant} disabled={grantSaving || !grantForm.userId}>
              {grantSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Gift className="w-4 h-4 mr-1" />}
              确认发放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== 兑换码管理 ==================== */

function RedeemCodesSection() {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");

  // 生成兑换码弹窗
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    plan: "monthly",
    count: "1",
    maxUses: "1",
    batchName: "",
    note: "",
    expiresInDays: "",
  });

  // 生成的兑换码展示
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (planFilter) params.set("plan", planFilter);

      const res = await fetch(`/api/admin/membership/redeem-codes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCodes(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      toast.error("加载兑换码列表失败");
    }
    setLoading(false);
  }, [page, statusFilter, planFilter]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const handleCreate = async () => {
    setCreateSaving(true);
    try {
      const res = await fetch("/api/admin/membership/redeem-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({
          plan: createForm.plan,
          count: parseInt(createForm.count) || 1,
          maxUses: parseInt(createForm.maxUses) || 1,
          batchName: createForm.batchName || undefined,
          note: createForm.note || undefined,
          expiresInDays: createForm.expiresInDays ? parseInt(createForm.expiresInDays) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`成功生成 ${data.count} 个兑换码`);
        setGeneratedCodes(data.codes || []);
        setShowResult(true);
        setCreateOpen(false);
        loadCodes();
      } else {
        toast.error(data.error || "生成失败");
      }
    } catch (err) {
      toast.error("生成失败");
    }
    setCreateSaving(false);
  };

  const handleToggleStatus = async (code: RedeemCode) => {
    const newStatus = code.status === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/admin/membership/redeem-codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        toast.success(newStatus === "disabled" ? "已禁用" : "已启用");
        loadCodes();
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch (err) {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (code: RedeemCode) => {
    if (!confirm("确定删除该兑换码？")) return;
    try {
      const res = await fetch(`/api/admin/membership/redeem-codes/${code.id}`, {
        method: "DELETE",
        headers: await withCsrfHeader(),
      });
      if (res.ok) {
        toast.success("已删除");
        loadCodes();
      } else {
        const data = await res.json();
        toast.error(data.error || "删除失败");
      }
    } catch (err) {
      toast.error("删除失败");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("已复制到剪贴板");
  };

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : (v ?? "")); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">可用</SelectItem>
              <SelectItem value="disabled">已禁用</SelectItem>
              <SelectItem value="expired">已过期</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v === "all" ? "" : (v ?? "")); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="套餐" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部套餐</SelectItem>
              <SelectItem value="monthly">月度</SelectItem>
              <SelectItem value="yearly">年度</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setShowResult(false); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          生成兑换码
        </Button>
      </div>

      {/* 生成结果展示 */}
      {showResult && generatedCodes.length > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">兑换码已生成</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowResult(false)}>关闭</Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {generatedCodes.map((code) => (
                <div key={code} className="flex items-center gap-1 bg-[var(--color-surface-card)] border rounded px-2 py-1">
                  <code className="text-sm font-mono">{code}</code>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyCode(code)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => copyCode(generatedCodes.join("\n"))}>
              复制全部
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 兑换码列表 */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">兑换码</th>
                <th className="text-left p-3">套餐</th>
                <th className="text-left p-3">使用情况</th>
                <th className="text-left p-3">批次</th>
                <th className="text-left p-3">过期时间</th>
                <th className="text-left p-3">状态</th>
                <th className="text-left p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{c.code}</code>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(c.code)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3">{PLAN_LABELS[c.plan] || c.plan}</td>
                  <td className="p-3">
                    <span className={c.used_count >= c.max_uses ? "text-red-600" : ""}>
                      {c.used_count}/{c.max_uses}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{c.batch_name || "-"}</td>
                  <td className="p-3 text-xs">{c.expires_at ? formatDate(c.expires_at) : "永不过期"}</td>
                  <td className="p-3">
                    <Badge className={CODE_STATUS_STYLES[c.status]?.color || "bg-gray-100"}>
                      {CODE_STATUS_STYLES[c.status]?.label || c.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title={c.status === "active" ? "禁用" : "启用"}
                        onClick={() => handleToggleStatus(c)}
                      >
                        {c.status === "active" ? <Ban className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                      </Button>
                      {c.used_count === 0 && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="删除" onClick={() => handleDelete(c)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {codes.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">暂无兑换码</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 生成兑换码弹窗 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成兑换码</DialogTitle>
            <DialogDescription>批量生成会员兑换码</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>会员套餐</Label>
              <Select value={createForm.plan} onValueChange={(v) => setCreateForm(f => ({ ...f, plan: v ?? "monthly" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">月度会员（30天）</SelectItem>
                  <SelectItem value="yearly">年度会员（365天）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>生成数量</Label>
                <Input type="number" min={1} max={100} value={createForm.count}
                  onChange={(e) => setCreateForm(f => ({ ...f, count: e.target.value }))} />
              </div>
              <div>
                <Label>每个码可兑换次数</Label>
                <Input type="number" min={1} max={1000} value={createForm.maxUses}
                  onChange={(e) => setCreateForm(f => ({ ...f, maxUses: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>批次名称</Label>
              <Input placeholder="如：2026活动推广" value={createForm.batchName}
                onChange={(e) => setCreateForm(f => ({ ...f, batchName: e.target.value }))} />
            </div>
            <div>
              <Label>兑换码过期天数（留空=永不过期）</Label>
              <Input type="number" placeholder="如：30" value={createForm.expiresInDays}
                onChange={(e) => setCreateForm(f => ({ ...f, expiresInDays: e.target.value }))} />
            </div>
            <div>
              <Label>备注</Label>
              <Textarea placeholder="说明用途" value={createForm.note}
                onChange={(e) => setCreateForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createSaving}>
              {createSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== 到期监控 ==================== */

function ExpiringSection() {
  const [expiringMembers, setExpiringMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkDays, setCheckDays] = useState("7");
  const [checking, setChecking] = useState(false);

  const loadExpiring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/membership?action=expiring&days=${checkDays}`);
      if (res.ok) {
        const data = await res.json();
        setExpiringMembers(data.data || []);
      }
    } catch (err) {
      toast.error("加载到期监控失败");
    }
    setLoading(false);
  }, [checkDays]);

  useEffect(() => { loadExpiring(); }, [loadExpiring]);

  const handleCheckExpiring = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/membership/check-expiring", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ days: parseInt(checkDays) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`检查完成：${data.expiredCount} 个已过期，${data.notifiedCount} 个已发送提醒`);
        loadExpiring();
      } else {
        toast.error(data.error || "检查失败");
      }
    } catch (err) {
      toast.error("检查失败");
    }
    setChecking(false);
  };

  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label>查看范围</Label>
          <Select value={checkDays} onValueChange={(v) => setCheckDays(v ?? "7")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3天内</SelectItem>
              <SelectItem value="7">7天内</SelectItem>
              <SelectItem value="14">14天内</SelectItem>
              <SelectItem value="30">30天内</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadExpiring}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
        </div>
        <Button onClick={handleCheckExpiring} disabled={checking}>
          <Bell className="w-4 h-4 mr-1" />
          {checking ? "检查中..." : "发送到期提醒"}
        </Button>
      </div>

      {/* 即将到期列表 */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : expiringMembers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {checkDays}天内没有即将到期的会员
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">用户</th>
                <th className="text-left p-3">套餐</th>
                <th className="text-left p-3">到期时间</th>
                <th className="text-left p-3">剩余天数</th>
                <th className="text-left p-3">来源</th>
              </tr>
            </thead>
            <tbody>
              {expiringMembers.map((m: any) => {
                const daysLeft = getDaysLeft(m.expires_at);
                return (
                  <tr key={m.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{m.user_name || `用户#${m.user_id}`}</div>
                    </td>
                    <td className="p-3">{PLAN_LABELS[m.plan] || m.plan}</td>
                    <td className="p-3 text-xs">{formatDate(m.expires_at)}</td>
                    <td className="p-3">
                      <Badge className={daysLeft <= 3 ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"}>
                        {daysLeft}天
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={SOURCE_LABELS[m.source]?.color || "bg-gray-100"}>
                        {SOURCE_LABELS[m.source]?.label || m.source}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}