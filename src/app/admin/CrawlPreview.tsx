"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Eye,
  CheckSquare,
  Square,
  Image as ImageIcon,
  Video,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// 类型定义
// ============================================================

interface CrawlSession {
  id: number;
  source_url: string;
  source_type: string;
  category: string;
  tags: string;
  total_count: number;
  selected_count: number;
  imported_count: number;
  status: string;
  created_at: string;
}

interface PreviewItem {
  id: number;
  session_id: number;
  source_url: string;
  title: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  media_type: "image" | "video";
  is_selected: number;
  source: string;
  tags: string;
  category: string;
  video_url: string | null;
  poster_url: string | null;
  created_at: string;
}

type ImportStatus = "idle" | "importing" | "done" | "error";

// ============================================================
// 缩略图预览组件
// ============================================================

function ItemThumbnail({ item }: { item: PreviewItem }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        {item.media_type === "video" ? (
          <Video className="w-8 h-8 text-muted-foreground" />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
    );
  }

  if (item.media_type === "video") {
    return (
      <div className="relative w-full h-full">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setHasError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Video className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <span className="absolute top-1 right-1 text-[9px] font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-1.5 py-0.5 rounded">
          LIVE
        </span>
      </div>
    );
  }

  return (
    <img
      src={item.source_url}
      alt={item.title}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

// ============================================================
// 主组件
// ============================================================

export default function CrawlPreview() {
  const [session, setSession] = useState<CrawlSession | null>(null);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importProgress, setImportProgress] = useState("");
  const [noSession, setNoSession] = useState(false);

  const pageSize = 20;

  // ==================== 加载数据 ====================

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/crawl/preview?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      if (!data.session) {
        setNoSession(true);
        setSession(null);
        setItems([]);
      } else {
        setNoSession(false);
        setSession(data.session);
        setItems(data.items || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        // 如果 session 已是 completed，显示完成状态
        if (data.session.status === "completed") {
          setImportStatus("done");
          setImportProgress(`已完成入库 ${data.session.imported_count} 张`);
        }
      }
    } catch (err: any) {
      toast.error("加载预览数据失败");
      setNoSession(true);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // ==================== 选中/取消 ====================

  const toggleSelect = async (itemId: number, currentSelected: number) => {
    const csrfHeaders = await withCsrfHeader();
    const newSelected = currentSelected ? 0 : 1;

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, is_selected: newSelected } : it))
    );
    setSession((prev) =>
      prev ? { ...prev, selected_count: prev.selected_count + (newSelected ? 1 : -1) } : prev
    );

    try {
      await fetch("/api/admin/crawl/preview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          session_id: session?.id,
          item_ids: [itemId],
          selected: !!newSelected,
        }),
      });
    } catch {
      toast.error("操作失败");
      loadPreview();
    }
  };

  const selectAll = async () => {
    const csrfHeaders = await withCsrfHeader();
    const allSelected = items.every((it) => it.is_selected);
    const newVal = allSelected ? 0 : 1;

    // Optimistic update
    setItems((prev) => prev.map((it) => ({ ...it, is_selected: newVal })));
    setSession((prev) =>
      prev ? { ...prev, selected_count: newVal ? prev.total_count : 0 } : prev
    );

    try {
      await fetch("/api/admin/crawl/preview", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          session_id: session?.id,
          select_all: !allSelected,
        }),
      });
    } catch {
      toast.error("操作失败");
      loadPreview();
    }
  };

  // ==================== 确认入库 ====================

  const confirmImport = async () => {
    if (!session || session.selected_count === 0) {
      toast.error("请至少选择一张图片");
      return;
    }

    setImportStatus("importing");
    setImportProgress("正在下载并入库选中的内容...");

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/crawl/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ session_id: session.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImportStatus("error");
        setImportProgress(data.error || "入库失败");
        toast.error(data.error || "入库失败");
        return;
      }

      setImportStatus("done");
      setImportProgress(data.message);
      toast.success(data.message);
      loadPreview();
    } catch (err: any) {
      setImportStatus("error");
      setImportProgress(err.message || "请求失败");
      toast.error("入库请求失败");
    }
  };

  // ==================== 丢弃会话 ====================

  const discardSession = async () => {
    if (!session) return;
    if (!confirm(`确定要丢弃此会话的全部 ${session.total_count} 张图片吗？此操作不可撤销。`)) return;

    try {
      const csrfHeaders = await withCsrfHeader();
      await fetch(`/api/admin/crawl/preview?session_id=${session.id}`, {
        method: "DELETE",
        headers: csrfHeaders,
      });
      toast.success("会话已丢弃");
      setNoSession(true);
      setSession(null);
      setItems([]);
    } catch {
      toast.error("丢弃失败");
    }
  };

  // ==================== 渲染 ====================

  // 加载态
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="rounded-lg border overflow-hidden bg-muted/30">
                  <Skeleton className="aspect-[4/3]" />
                  <div className="p-2 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 空态
  if (noSession || !session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            爬虫预览选择
          </CardTitle>
          <CardDescription>没有待选择的爬取结果</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">暂无待选择的爬取图片</p>
            <p className="text-xs mt-1">请先进行爬取操作</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allSelected = items.length > 0 && items.every((it) => it.is_selected);
  const someSelected = items.some((it) => it.is_selected);
  const isDisabled = importStatus === "importing" || session.status === "completed";

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                选择要入库的图片
              </CardTitle>
              <CardDescription className="mt-1">
                来源：{session.source_type || "自定义URL"} | 共 {session.total_count}{" "}
                张 | 已选{" "}
                <span className="font-medium text-green-600">{session.selected_count}</span> 张
                {session.status === "completed" && (
                  <span className="ml-2 text-green-600 font-medium">
                    （已完成入库 {session.imported_count} 张）
                  </span>
                )}
              </CardDescription>
            </div>
            {importStatus !== "idle" && (
              <Badge
                className={
                  importStatus === "importing"
                    ? "bg-blue-100 text-blue-700"
                    : importStatus === "done"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }
              >
                {importStatus === "importing" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {importStatus === "done" && <CheckCircle className="w-3 h-3 mr-1" />}
                {importStatus === "error" && <AlertCircle className="w-3 h-3 mr-1" />}
                {importStatus === "importing" ? "入库中" : importStatus === "done" ? "完成" : "失败"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} disabled={isDisabled}>
              {allSelected ? (
                <>
                  <Square className="w-4 h-4 mr-1.5" />
                  取消全选
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 mr-1.5" />
                  全选
                </>
              )}
            </Button>
            <Button
              onClick={confirmImport}
              disabled={session.selected_count === 0 || isDisabled}
              className="gap-1.5"
            >
              {importStatus === "importing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  入库中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  确认入库 ({session.selected_count}张)
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={discardSession}
              disabled={isDisabled}
              className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              丢弃全部
            </Button>
          </div>
          {importProgress && (
            <div
              className={`mt-3 text-sm ${importStatus === "error" ? "text-red-600" : "text-green-600"}`}
            >
              {importProgress}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 图片网格 */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const isSelected = !!item.is_selected;
              return (
                <div
                  key={item.id}
                  onClick={() => !isDisabled && toggleSelect(item.id, item.is_selected)}
                  className={`group relative rounded-lg border-2 overflow-hidden bg-muted/30 transition-all ${
                    isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                  } ${
                    isSelected
                      ? "border-green-500 shadow-md shadow-green-500/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  {/* 缩略图 */}
                  <div className="aspect-[4/3] relative">
                    <ItemThumbnail item={item} />
                    {isSelected && (
                      <div className="absolute inset-0 bg-green-500/10 flex items-start justify-end p-1.5">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.category && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {item.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {item.width}x{item.height}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <p className="text-xs text-muted-foreground">
                第 {page} 页 / 共 {totalPages} 页（{total} 张）
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
