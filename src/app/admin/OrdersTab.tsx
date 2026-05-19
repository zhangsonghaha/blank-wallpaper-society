"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShoppingBag,
  CreditCard,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

interface Order {
  id: number;
  user_id: number;
  type: "paid_wallpaper" | "tip" | "membership";
  related_id: number | null;
  amount: number;
  payment_method: string | null;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  description: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  paid_wallpaper: "付费壁纸",
  tip: "打赏",
  membership: "会员订阅",
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending: { label: "待确认", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  paid: { label: "已支付", color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  failed: { label: "已拒绝", color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  refunded: { label: "已退款", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400" },
};

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 筛选
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // 统计
  const [stats, setStats] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    paidCount: 0,
    paidAmount: 0,
  });

  // 拒绝确认对话框状态
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error("加载订单失败");
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterStatus, searchQuery]);

  // 加载统计
  const fetchStats = useCallback(async () => {
    try {
      const [pendingRes, paidRes] = await Promise.all([
        fetch("/api/admin/orders?status=pending&page_size=1"),
        fetch("/api/admin/orders?status=paid&page_size=1"),
      ]);
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setStats((prev) => ({ ...prev, pendingCount: data.total || 0 }));
      }
      if (paidRes.ok) {
        const data = await paidRes.json();
        setStats((prev) => ({ ...prev, paidCount: data.total || 0 }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 确认订单
  const handleConfirm = async (orderId: number) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ order_id: orderId, action: "confirm" }),
      });
      if (res.ok) {
        toast.success("订单已确认");
        fetchOrders();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("操作失败");
    }
  };

  // 拒绝订单（实际执行）
  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ order_id: rejectTarget, action: "reject" }),
      });
      if (res.ok) {
        toast.success("订单已拒绝");
        fetchOrders();
        fetchStats();
      } else {
        const data = await res.json();
        toast.error(data.error || "操作失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setRejectTarget(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            <div>
              <p className="text-sm text-amber-600 dark:text-amber-400">待确认</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">已确认</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.paidCount}</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400">总订单</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.pendingCount + stats.paidCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-ash)]" />
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] text-sm bg-[var(--color-canvas)] text-[var(--color-ink)]"
          >
            <option value="">全部类型</option>
            <option value="paid_wallpaper">付费壁纸</option>
            <option value="tip">打赏</option>
            <option value="membership">会员订阅</option>
          </select>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] text-sm bg-[var(--color-canvas)] text-[var(--color-ink)]"
        >
          <option value="">全部状态</option>
          <option value="pending">待确认</option>
          <option value="paid">已支付</option>
          <option value="failed">已拒绝</option>
          <option value="refunded">已退款</option>
        </select>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[var(--color-ash)]" />
          <input
            type="text"
            placeholder="搜索订单号/用户..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] text-sm bg-[var(--color-canvas)] text-[var(--color-ink)]"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchOrders(); fetchStats(); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          刷新
        </Button>
      </div>

      {/* 订单列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
          <span className="ml-2 text-[var(--color-ash)]">加载中...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="w-12 h-12 text-[var(--color-ash)] mx-auto mb-3" />
          <p className="text-[var(--color-ash)]">暂无订单</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusStyle = STATUS_STYLES[order.payment_status] || STATUS_STYLES.pending;
            return (
              <div
                key={order.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-elevated)] hover:shadow-md transition-shadow"
              >
                {/* 类型图标 */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  order.type === "paid_wallpaper" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" :
                  order.type === "tip" ? "bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400" :
                  "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                }`}>
                  {order.type === "paid_wallpaper" ? <ShoppingBag className="w-5 h-5" /> :
                   order.type === "tip" ? <DollarSign className="w-5 h-5" /> :
                   <CreditCard className="w-5 h-5" />}
                </div>

                {/* 订单信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--color-ink)]">
                      {TYPE_LABELS[order.type] || order.type}
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${statusStyle.color}`}>
                      {statusStyle.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-ash)]">
                    <span className="font-mono">{order.payment_id || `ORD#${order.id}`}</span>
                    <span>{order.description || "-"}</span>
                    {order.buyer_name && <span>用户: {order.buyer_name}</span>}
                  </div>
                </div>

                {/* 金额 */}
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--color-ink)]">¥{parseFloat(String(order.amount)).toFixed(2)}</p>
                  <p className="text-xs text-[var(--color-ash)]">
                    {new Date(order.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>

                {/* 操作按钮 */}
                {order.payment_status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(order.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      确认
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectTarget(order.id)}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      拒绝
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-[var(--color-ash)]">
            {page} / {totalPages} (共 {total} 条)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 拒绝订单确认对话框 */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>确认拒绝订单</DialogTitle>
            <DialogDescription>拒绝后订单将标记为"已拒绝"，此操作不可撤销。确定要继续吗？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectConfirm}
            >
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}