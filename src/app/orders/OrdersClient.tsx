"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Receipt,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Crown,
  ShoppingBag,
  DollarSign,
  CreditCard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Order {
  id: number;
  type: "paid_wallpaper" | "tip" | "membership";
  related_id: number | null;
  amount: number;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  description: string | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  paid_wallpaper: {
    label: "付费壁纸",
    icon: <ShoppingBag className="w-5 h-5" />,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  },
  tip: {
    label: "打赏",
    icon: <DollarSign className="w-5 h-5" />,
    color: "bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400",
  },
  membership: {
    label: "会员订阅",
    icon: <Crown className="w-5 h-5" />,
    color: "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  },
};

const STATUS_STYLES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "待确认",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  paid: {
    label: "已支付",
    color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  failed: {
    label: "已拒绝",
    color: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  refunded: {
    label: "已退款",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
};

export default function OrdersClient() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const pageSize = 10;

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchOrders();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [fetchOrders, status]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4">
        <Receipt className="w-16 h-16 text-[var(--color-ash)]" />
        <p className="text-[var(--color-mute)]">请先登录查看订单</p>
        <Link href="/login">
          <Button>登录</Button>
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-surface-card)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-[960px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </Link>
          <h1 className="text-lg font-semibold text-[var(--color-ink)]">我的订单</h1>
          <Link href="/pricing" className="flex items-center gap-1 text-amber-500 hover:text-amber-600 text-sm font-medium">
            <Crown className="w-4 h-4" />
            会员
          </Link>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 py-6">
        {/* Filter */}
        <div className="flex items-center gap-2 mb-6">
          {["", "pending", "paid", "failed"].map((s) => {
            const label = !s ? "全部" : STATUS_STYLES[s]?.label || s;
            return (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-[var(--color-primary)] text-white dark:bg-white dark:text-black"
                    : "bg-[var(--color-surface-elevated)] text-[var(--color-mute)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-16 h-16 text-[var(--color-ash)] mx-auto mb-4" />
            <p className="text-[var(--color-mute)] mb-4">暂无订单记录</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/">
                <Button variant="outline">浏览壁纸</Button>
              </Link>
              <Link href="/pricing">
                <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                  <Crown className="w-4 h-4 mr-1" />
                  升级Pro
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order, i) => {
              const typeInfo = TYPE_LABELS[order.type] || TYPE_LABELS.paid_wallpaper;
              const statusInfo = STATUS_STYLES[order.payment_status] || STATUS_STYLES.pending;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-elevated)] hover:shadow-sm transition-shadow"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeInfo.color}`}>
                    {typeInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-[var(--color-ink)]">{typeInfo.label}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 flex items-center gap-0.5 ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-ash)] truncate">
                      {order.description || order.payment_id || `订单#${order.id}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[var(--color-ink)]">¥{parseFloat(String(order.amount)).toFixed(2)}</p>
                    <p className="text-xs text-[var(--color-ash)]">{new Date(order.created_at).toLocaleString("zh-CN")}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-[var(--color-ash)]">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}