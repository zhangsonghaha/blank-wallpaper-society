"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Download,
  Eye,
  UserX,
  RefreshCw,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

type LogType = "admin_operation" | "download" | "view" | "account_deletion";

const LOG_TYPE_CONFIG: Record<
  LogType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  admin_operation: {
    label: "操作日志",
    icon: <ShieldCheck className="w-4 h-4" />,
    color: "text-orange-600",
  },
  download: {
    label: "下载日志",
    icon: <Download className="w-4 h-4" />,
    color: "text-blue-600",
  },
  view: {
    label: "浏览日志",
    icon: <Eye className="w-4 h-4" />,
    color: "text-green-600",
  },
  account_deletion: {
    label: "账号删除日志",
    icon: <UserX className="w-4 h-4" />,
    color: "text-red-600",
  },
};

// 操作类型标签映射
const OPERATION_LABELS: Record<string, string> = {
  review_approve: "审核通过",
  review_reject: "审核拒绝",
  user_ban: "封禁用户",
  user_unban: "解封用户",
  user_delete: "删除用户",
  user_role_change: "修改角色",
  image_delete: "删除图片",
  image_batch_delete: "批量删除图片",
  category_create: "创建分类",
  category_update: "更新分类",
  category_delete: "删除分类",
  settings_update: "更新设置",
  crawl_start: "启动爬虫",
  crawl_stop: "停止爬虫",
  notification_send: "发送通知",
  account_deletion_approve: "批准注销",
  account_deletion_cancel: "取消注销",
};

// 账号删除操作映射
const DELETION_ACTION_LABELS: Record<string, string> = {
  requested: "申请注销",
  cancelled: "取消注销",
  completed: "注销完成",
  admin_suspended: "管理员暂停",
  admin_deleted: "管理员删除",
};

export default function LogsTab() {
  const [activeType, setActiveType] = useState<LogType>("admin_operation");
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);

  // 筛选条件
  const [filterOperation, setFilterOperation] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterImageId, setFilterImageId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [operations, setOperations] = useState<string[]>([]);

  // 清理对话框
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false);
  const [cleanType, setCleanType] = useState<LogType>("admin_operation");
  const [cleanBeforeDate, setCleanBeforeDate] = useState("");

  // 详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailContent, setDetailContent] = useState<any>(null);

  // 获取概览数据
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/logs?type=overview");
      if (res.ok) {
        const data = await res.json();
        setOverview(data.data);
      }
    } catch (err) {
      console.error("获取日志概览失败:", err);
    }
  }, []);

  // 获取日志列表
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeType,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filterOperation) params.set("operation", filterOperation);
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);
      if (filterImageId) params.set("imageId", filterImageId);
      if (filterUserId) params.set("userId", filterUserId);
      if (filterAction) params.set("action", filterAction);

      const res = await fetch(`/api/admin/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data?.logs || []);
        setTotal(data.data?.total || 0);
        if (data.data?.operations) {
          setOperations(
            (data.data.operations as any[]).map((o: any) => o.operation)
          );
        }
      }
    } catch (err) {
      console.error("获取日志失败:", err);
    } finally {
      setLoading(false);
    }
  }, [activeType, page, pageSize, filterOperation, filterStartDate, filterEndDate, filterImageId, filterUserId, filterAction]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 切换日志类型时重置筛选和页码
  const handleTypeChange = (type: LogType) => {
    setActiveType(type);
    setPage(1);
    setFilterOperation("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterImageId("");
    setFilterUserId("");
    setFilterAction("");
  };

  // 清理日志
  const handleClean = async () => {
    if (!cleanBeforeDate) {
      toast.error("请选择清理日期");
      return;
    }
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ type: cleanType, beforeDate: cleanBeforeDate }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        setCleanDialogOpen(false);
        setCleanBeforeDate("");
        fetchLogs();
        fetchOverview();
      } else {
        const data = await res.json();
        toast.error(data.error || "清理失败");
      }
    } catch (err) {
      toast.error("清理日志失败");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // 格式化时间
  const formatTime = (t: string) => {
    if (!t) return "-";
    return new Date(t).toLocaleString("zh-CN");
  };

  // 渲染操作类型 badge
  const renderOperationBadge = (op: string) => {
    const label = OPERATION_LABELS[op] || op;
    const isSensitive = [
      "user_ban",
      "user_delete",
      "image_batch_delete",
      "account_deletion_approve",
    ].includes(op);
    return (
      <Badge variant={isSensitive ? "destructive" : "secondary"}>{label}</Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">日志管理</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchLogs(); fetchOverview(); }}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> 刷新
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCleanDialogOpen(true)}>
            <Trash2 className="w-4 h-4 mr-1" /> 清理日志
          </Button>
        </div>
      </div>

      {/* 概览卡片 */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="cursor-pointer hover:ring-2 hover:ring-orange-300" onClick={() => handleTypeChange("admin_operation")}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-[var(--color-mute)]">操作日志</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold text-orange-600">{overview.totalAdminOps}</div>
              <div className="text-xs text-[var(--color-mute)]">今日 +{overview.todayOps}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-blue-300" onClick={() => handleTypeChange("download")}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-[var(--color-mute)]">下载日志</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold text-blue-600">{overview.totalDownloads}</div>
              <div className="text-xs text-[var(--color-mute)]">今日 +{overview.todayDownloads}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-green-300" onClick={() => handleTypeChange("view")}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-[var(--color-mute)]">浏览日志</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold text-green-600">{overview.totalViews}</div>
              <div className="text-xs text-[var(--color-mute)]">今日 +{overview.todayViews}</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:ring-2 hover:ring-red-300" onClick={() => handleTypeChange("account_deletion")}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-[var(--color-mute)]">账号删除</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold text-red-600">{overview.totalAccountDeletions}</div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> 7日趋势
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-end gap-1 h-8">
                {(overview.downloadTrend || []).map((item: any, idx: number) => {
                  const maxCount = Math.max(...(overview.downloadTrend || []).map((d: any) => d.count), 1);
                  const height = (item.count / maxCount) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-blue-400 dark:bg-blue-500 rounded-t"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${item.date}: ${item.count}次下载`}
                    />
                  );
                })}
                {(!overview.downloadTrend || overview.downloadTrend.length === 0) && (
                  <span className="text-xs text-[var(--color-mute)]">暂无数据</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 日志类型切换 */}
      <div className="flex gap-2 border-b pb-2">
        {(Object.keys(LOG_TYPE_CONFIG) as LogType[]).map((type) => {
          const config = LOG_TYPE_CONFIG[type];
          return (
            <Button
              key={type}
              variant={activeType === type ? "default" : "ghost"}
              size="sm"
              onClick={() => handleTypeChange(type)}
              className="flex items-center gap-1.5"
            >
              {config.icon}
              {config.label}
            </Button>
          );
        })}
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-mute)]">开始日期</label>
          <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-mute)]">结束日期</label>
          <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-36 h-8 text-sm" />
        </div>
        {activeType === "admin_operation" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-mute)]">操作类型</label>
            <Select value={filterOperation} onValueChange={(v) => v && setFilterOperation(v)}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {operations.map((op) => (
                  <SelectItem key={op} value={op}>{OPERATION_LABELS[op] || op}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(activeType === "download" || activeType === "view") && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--color-mute)]">图片ID</label>
              <Input value={filterImageId} onChange={(e) => setFilterImageId(e.target.value)} placeholder="图片ID" className="w-24 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-[var(--color-mute)]">用户ID</label>
              <Input value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} placeholder="用户ID" className="w-24 h-8 text-sm" />
            </div>
          </>
        )}
        {activeType === "account_deletion" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-[var(--color-mute)]">操作</label>
            <Select value={filterAction} onValueChange={(v) => v && setFilterAction(v)}>
              <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="全部" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {Object.entries(DELETION_ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" variant="outline" onClick={() => fetchLogs()}>
          <Search className="w-4 h-4 mr-1" /> 筛选
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setFilterOperation(""); setFilterStartDate(""); setFilterEndDate(""); setFilterImageId(""); setFilterUserId(""); setFilterAction(""); setPage(1); }}>
          重置
        </Button>
      </div>

      {/* 日志表格 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-soft)] border-b">
              {activeType === "admin_operation" && (
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">操作人</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">操作类型</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">目标用户</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">详情</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">时间</th>
                </tr>
              )}
              {activeType === "download" && (
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">图片</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">用户</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">分辨率</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">IP</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">时间</th>
                </tr>
              )}
              {activeType === "view" && (
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">图片</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">用户</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">IP</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">时间</th>
                </tr>
              )}
              {activeType === "account_deletion" && (
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">用户</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">操作</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">操作人</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">详情</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-mute)]">时间</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-mute)]">加载中...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-mute)]">暂无日志数据</td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-[var(--color-surface-soft)] transition-colors">
                    {activeType === "admin_operation" && (
                      <>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.id}</td>
                        <td className="px-4 py-2.5 font-medium">{log.operator_name || `用户#${log.operator_id}`}</td>
                        <td className="px-4 py-2.5">{renderOperationBadge(log.operation)}</td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.target_user_name || log.target_user_id || "-"}</td>
                        <td className="px-4 py-2.5">
                          {log.detail ? (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                              const detail = typeof log.detail === "string" ? JSON.parse(log.detail) : log.detail;
                              setDetailContent(detail);
                              setDetailDialogOpen(true);
                            }}>查看详情</Button>
                          ) : <span className="text-[var(--color-mute)]">-</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)] whitespace-nowrap">{formatTime(log.created_at)}</td>
                      </>
                    )}
                    {activeType === "download" && (
                      <>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.id}</td>
                        <td className="px-4 py-2.5">
                          {log.image_title ? <span className="font-medium truncate max-w-[200px] inline-block align-bottom">{log.image_title}</span> : <span className="text-[var(--color-mute)]">#{log.image_id}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.user_name || (log.user_id ? `#${log.user_id}` : "游客")}</td>
                        <td className="px-4 py-2.5">{log.resolution ? <Badge variant="secondary">{log.resolution}</Badge> : <span className="text-[var(--color-mute)]">-</span>}</td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)] font-mono text-xs">{log.ip_address || "-"}</td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)] whitespace-nowrap">{formatTime(log.created_at)}</td>
                      </>
                    )}
                    {activeType === "view" && (
                      <>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.id}</td>
                        <td className="px-4 py-2.5">
                          {log.image_title ? <span className="font-medium truncate max-w-[200px] inline-block align-bottom">{log.image_title}</span> : <span className="text-[var(--color-mute)]">#{log.image_id}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.user_name || (log.user_id ? `#${log.user_id}` : "游客")}</td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)] font-mono text-xs">{log.ip_address || "-"}</td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)] whitespace-nowrap">{formatTime(log.created_at)}</td>
                      </>
                    )}
                    {activeType === "account_deletion" && (
                      <>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.id}</td>
                        <td className="px-4 py-2.5 font-medium">{log.user_name || `用户#${log.user_id}`}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={log.action === "completed" || log.action === "admin_deleted" ? "destructive" : "secondary"}>
                            {DELETION_ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)]">{log.operator_name || "-"}</td>
                        <td className="px-4 py-2.5">
                          {log.details ? (
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setDetailContent({ details: log.details }); setDetailDialogOpen(true); }}>查看详情</Button>
                          ) : <span className="text-[var(--color-mute)]">-</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-mute)] whitespace-nowrap">{formatTime(log.created_at)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--color-mute)]">共 {total} 条记录，第 {page}/{totalPages} 页</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-2">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 操作类型分布 */}
      {activeType === "admin_operation" && overview?.opDistribution?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5" /> 操作类型分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overview.opDistribution.map((item: any) => {
                const maxCount = Math.max(...overview.opDistribution.map((d: any) => d.count), 1);
                const width = (item.count / maxCount) * 100;
                return (
                  <div key={item.operation} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-[var(--color-mute)] shrink-0">{OPERATION_LABELS[item.operation] || item.operation}</span>
                    <div className="flex-1 h-5 bg-[var(--color-surface-soft)] rounded overflow-hidden">
                      <div className="h-full bg-orange-400 rounded transition-all" style={{ width: `${Math.max(width, 2)}%` }} />
                    </div>
                    <span className="w-12 text-right text-sm font-medium">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
            <DialogDescription>查看该条日志的详细信息</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            <pre className="text-sm bg-[var(--color-surface-soft)] p-4 rounded-lg whitespace-pre-wrap break-words">
              {detailContent ? JSON.stringify(detailContent, null, 2) : "无详情"}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清理日志对话框 */}
      <Dialog open={cleanDialogOpen} onOpenChange={setCleanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清理日志</DialogTitle>
            <DialogDescription>清理指定日期之前的日志数据，此操作不可撤销</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">日志类型</label>
              <Select value={cleanType} onValueChange={(v) => v && setCleanType(v as LogType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOG_TYPE_CONFIG) as LogType[]).map((type) => (
                    <SelectItem key={type} value={type}>{LOG_TYPE_CONFIG[type].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">清理此日期之前的日志</label>
              <Input type="date" value={cleanBeforeDate} onChange={(e) => setCleanBeforeDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCleanDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleClean} disabled={!cleanBeforeDate}>确认清理</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}