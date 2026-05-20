"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BadgeCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Image as ImageIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VerificationItem {
  id: number;
  name: string;
  avatar: string | null;
  email: string;
  verification_status: string;
  verification_applied_at: string;
  verification_rejected_reason: string | null;
  verification_real_name: string | null;
  verification_id_type: string | null;
  verification_id_number: string | null;
  verification_portfolio_url: string | null;
  brand_name: string | null;
  brand_description: string | null;
  img_count: number;
}

const ID_TYPE_LABELS: Record<string, string> = {
  id_card: "身份证",
  passport: "护照",
  driver_license: "驾照",
  other: "其他",
};

export default function VerificationTab() {
  const [activeStatus, setActiveStatus] = useState("pending");
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [loading, setLoading] = useState(false);

  // 审核对话框
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewingUser, setReviewingUser] = useState<VerificationItem | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // 获取待审核列表
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/verifications?status=${activeStatus}&page=${page}&limit=${limit}`
      );
      const data = await res.json();
      if (res.ok) {
        setItems(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("获取认证列表失败:", error);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, page, limit]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 切换状态标签时重置页码
  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    setPage(1);
  };

  // 打开审核对话框
  const openReviewDialog = (item: VerificationItem, action: "approve" | "reject") => {
    setReviewingUser(item);
    setReviewAction(action);
    setReviewReason("");
    setReviewDialogOpen(true);
  };

  // 提交审核
  const handleReview = async () => {
    if (!reviewingUser) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/admin/verify/${reviewingUser.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...await withCsrfHeader(),
        },
        body: JSON.stringify({
          action: reviewAction,
          reason: reviewAction === "reject" ? reviewReason : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setReviewDialogOpen(false);
        fetchItems();
      } else {
        toast.error(data.error || "审核失败");
      }
    } catch {
      toast.error("审核失败，请稍后重试");
    } finally {
      setReviewLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // 统计数据
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "待审核";
      case "approved": return "已通过";
      case "rejected": return "已拒绝";
      default: return status;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BadgeCheck className="w-6 h-6" />
          创作者认证审核
        </h2>
      </div>

      {/* 状态筛选 */}
      <Tabs value={activeStatus} onValueChange={handleStatusChange}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="w-3.5 h-3.5" /> 待审核
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 已通过
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1">
            <XCircle className="w-3.5 h-3.5" /> 已拒绝
          </TabsTrigger>
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 列表 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          暂无{getStatusLabel(activeStatus)}的认证申请
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarImage src={item.avatar || undefined} />
                      <AvatarFallback>
                        {item.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{item.name}</span>
                        <Badge
                          variant={
                            item.verification_status === "approved"
                              ? "default"
                              : item.verification_status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="gap-1"
                        >
                          {getStatusIcon(item.verification_status)}
                          {getStatusLabel(item.verification_status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          <span>真实姓名：{item.verification_real_name || "未提供"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>已上传 {item.img_count} 张作品</span>
                        </div>
                        {item.verification_id_type && (
                          <div>
                            证件类型：{ID_TYPE_LABELS[item.verification_id_type] || item.verification_id_type}
                          </div>
                        )}
                        {item.verification_portfolio_url && (
                          <div className="flex items-center gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <a
                              href={item.verification_portfolio_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline truncate"
                            >
                              作品集链接
                            </a>
                          </div>
                        )}
                        {item.brand_name && (
                          <div>品牌：{item.brand_name}</div>
                        )}
                        {item.verification_applied_at && (
                          <div>申请时间：{new Date(item.verification_applied_at).toLocaleString()}</div>
                        )}
                        {item.verification_rejected_reason && (
                          <div className="text-red-500">
                            拒绝原因：{item.verification_rejected_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {item.verification_status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openReviewDialog(item, "approve")}
                        className="gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" /> 通过
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openReviewDialog(item, "reject")}
                        className="gap-1"
                      >
                        <XCircle className="w-4 h-4" /> 拒绝
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages} (共 {total} 条)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 审核对话框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "通过认证" : "拒绝认证"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? `确认通过 ${reviewingUser?.name} 的创作者认证申请？`
                : `拒绝 ${reviewingUser?.name} 的创作者认证申请，请填写拒绝原因。`}
            </DialogDescription>
          </DialogHeader>

          {reviewAction === "reject" && (
            <div className="space-y-2">
              <Label htmlFor="reason">拒绝原因</Label>
              <Textarea
                id="reason"
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                placeholder="请填写拒绝原因，以便申请人了解并改进"
                maxLength={500}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={reviewLoading}
            >
              取消
            </Button>
            <Button
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={handleReview}
              disabled={reviewLoading}
            >
              {reviewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : reviewAction === "approve" ? (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              ) : (
                <XCircle className="w-4 h-4 mr-1" />
              )}
              确认{reviewAction === "approve" ? "通过" : "拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}