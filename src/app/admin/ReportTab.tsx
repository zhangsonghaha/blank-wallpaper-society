"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  Flag,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReportRecord {
  id: number;
  image_id: number;
  reporter_id: number;
  reason: string;
  status: string;
  created_at: string;
  resolved_by: number | null;
  resolved_at: string | null;
  image_title: string;
  image_url: string;
  image_thumbnail: string | null;
  reporter_name: string;
  reporter_email: string;
  resolver_name: string | null;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const reportStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "待处理", color: "text-amber-700", bgColor: "bg-amber-50" },
  reviewed: { label: "已驳回", color: "text-blue-700", bgColor: "bg-blue-50" },
  resolved: { label: "已处理", color: "text-emerald-700", bgColor: "bg-emerald-50" },
};

export default function ReportTab() {
  const [status, setStatus] = useState("pending");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [processing, setProcessing] = useState(false);

  const limit = 12;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error("获取数据失败");
      const data = await res.json();

      setReports(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("加载举报列表失败:", err);
      toast.error("加载举报列表失败");
    }
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (reportId: number, action: "dismiss" | "remove") => {
    setProcessing(true);
    try {
      const res = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        loadData();
      } else {
        toast.error("操作失败", { description: data.error });
      }
    } catch {
      toast.error("操作失败");
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      {/* 状态筛选 */}
      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList variant="line">
          <TabsTrigger value="pending" className="gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            待处理
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="gap-1.5">
            <MessageSquare className="w-4 h-4" />
            已驳回
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            已处理
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 统计 */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-mute)]">
        <span>共 {total} 条举报</span>
      </div>

      {/* 举报列表 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
            <Flag className="w-8 h-8 text-[var(--color-ash)]" />
          </div>
          <h3 className="text-lg font-semibold mb-1">没有举报记录</h3>
          <p className="text-sm text-[var(--color-mute)]">
            {status === "pending" ? "所有举报都已处理完毕" : "切换状态查看其他记录"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const cfg = reportStatusConfig[report.status] || reportStatusConfig.pending;
            return (
              <Card key={report.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* 举报图片缩略图 */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
                      <img
                        src={report.image_thumbnail || report.image_url}
                        alt={report.image_title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* 举报信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium truncate">{report.image_title}</p>
                          <p className="text-xs text-[var(--color-mute)] mt-0.5">
                            举报人: {report.reporter_name || "未知"} ({report.reporter_email})
                          </p>
                        </div>
                        <Badge className={`${cfg.bgColor} ${cfg.color} rounded-full text-xs flex-shrink-0`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="mt-2 px-3 py-2 rounded-lg bg-[var(--color-surface-soft)] text-sm text-[var(--color-body)]">
                        <p className="text-xs text-[var(--color-mute)] mb-1">举报原因:</p>
                        {report.reason}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-[var(--color-ash)]">
                          {formatDate(report.created_at)}
                          {report.resolver_name && ` · 处理人: ${report.resolver_name}`}
                        </p>
                        {report.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs h-7 gap-1"
                              onClick={() => handleAction(report.id, "dismiss")}
                              disabled={processing}
                            >
                              驳回举报
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-full text-xs h-7 gap-1"
                              onClick={() => handleAction(report.id, "remove")}
                              disabled={processing}
                            >
                              <ImageOff className="w-3 h-3" />
                              下架图片
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-mute)]">
            第 {page}/{totalPages} 页
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
      )}
    </div>
  );
}