"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldX,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  MessageSquare,
  ImageOff,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ReviewImage {
  id: number;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  author: string;
  tags: string;
  category: string;
  status: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  reviewer_name: string | null;
  created_at: string;
}

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

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: "待审核", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: Clock },
  approved: { label: "已通过", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "已拒绝", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: XCircle },
};

const reportStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "待处理", color: "text-amber-700", bgColor: "bg-amber-50" },
  reviewed: { label: "已驳回", color: "text-blue-700", bgColor: "bg-blue-50" },
  resolved: { label: "已处理", color: "text-emerald-700", bgColor: "bg-emerald-50" },
};

/* ==================== 审核队列子组件 ==================== */

function ReviewQueue() {
  const [status, setStatus] = useState("pending");
  const [images, setImages] = useState<ReviewImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectImageId, setRejectImageId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const limit = 12;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/admin/review?${params}`);
      if (!res.ok) throw new Error("获取数据失败");
      const data = await res.json();

      setImages(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error("加载审核列表失败:", err);
      toast.error("加载审核列表失败");
    }
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (imageId: number) => {
    setReviewing(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, action: "approve" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("已通过审核");
        loadData();
      } else {
        toast.error("操作失败", { description: data.error });
      }
    } catch {
      toast.error("操作失败");
    }
    setReviewing(false);
  };

  const openRejectDialog = (imageId: number) => {
    setRejectImageId(imageId);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("请填写拒绝原因");
      return;
    }
    setReviewing(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: rejectImageId,
          action: "reject",
          rejectReason: rejectReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("已拒绝");
        setRejectDialogOpen(false);
        loadData();
      } else {
        toast.error("操作失败", { description: data.error });
      }
    } catch {
      toast.error("操作失败");
    }
    setReviewing(false);
  };

  return (
    <div className="space-y-4">
      {/* 状态筛选 */}
      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <TabsList variant="line">
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="w-4 h-4" />
            待审核
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            已通过
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            <XCircle className="w-4 h-4" />
            已拒绝
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 统计信息 */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-mute)]">
        <span>共 {total} 张图片</span>
      </div>

      {/* 图片网格 */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-[var(--color-ash)]" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {status === "pending" ? "没有待审核的图片" : status === "approved" ? "没有已通过的图片" : "没有已拒绝的图片"}
          </h3>
          <p className="text-sm text-[var(--color-mute)]">
            {status === "pending" ? "所有图片都已审核完毕" : "切换状态查看其他图片"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image) => {
            const cfg = statusConfig[image.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={image.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                {/* 缩略图 */}
                <div className="relative aspect-[3/4] bg-[var(--color-surface-card)] overflow-hidden">
                  <img
                    src={image.thumbnail_url || image.url}
                    alt={image.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* 状态标签 */}
                  <div className="absolute top-2 left-2">
                    <Badge className={`${cfg.bgColor} ${cfg.color} border gap-1 rounded-full text-xs`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                  {/* 操作按钮覆盖层 */}
                  {image.status === "pending" && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-full gap-1"
                        onClick={() => handleApprove(image.id)}
                        disabled={reviewing}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full gap-1"
                        onClick={() => openRejectDialog(image.id)}
                        disabled={reviewing}
                      >
                        <XCircle className="w-4 h-4" />
                        拒绝
                      </Button>
                    </div>
                  )}
                </div>
                {/* 信息区 */}
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{image.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-mute)]">
                    <span>{image.author || "未知作者"}</span>
                    <span className="text-[var(--color-hairline)]">|</span>
                    <span>{image.width}x{image.height}</span>
                  </div>
                  {image.status === "rejected" && image.reject_reason && (
                    <p className="text-xs text-red-500 mt-1 truncate" title={image.reject_reason}>
                      原因: {image.reject_reason}
                    </p>
                  )}
                  {image.reviewed_at && (
                    <p className="text-xs text-[var(--color-ash)] mt-1">
                      审核人: {image.reviewer_name || "未知"} · {formatDate(image.reviewed_at)}
                    </p>
                  )}
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

      {/* 拒绝原因弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              拒绝图片
            </DialogTitle>
            <DialogDescription>
              请填写拒绝原因，该原因将通知给上传者
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">拒绝原因 *</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因，如：图片质量不达标、内容违规等..."
              className="mt-1 h-24 rounded-xl resize-none"
              maxLength={500}
            />
            <p className="text-xs text-[var(--color-mute)] mt-1 text-right">
              {rejectReason.length}/500
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={reviewing || !rejectReason.trim()}
              className="rounded-full gap-2"
            >
              {reviewing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ==================== 举报管理子组件 ==================== */

function ReportManagement() {
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

/* ==================== 主审核管理组件 ==================== */

export default function ReviewTab() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="review">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="review" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            审核队列
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <Flag className="w-4 h-4" />
            举报管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <ReviewQueue />
        </TabsContent>

        <TabsContent value="reports">
          <ReportManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}