"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Search,
  RefreshCw,
  Eye,
  Send,
  FileText,
  AlertTriangle,
  Info,
  Clock,
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
import { Switch } from "@/components/ui/switch";

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: "notice" | "announcement" | "maintenance";
  priority: "low" | "normal" | "high" | "urgent";
  is_published: number;
  start_time: string | null;
  end_time: string | null;
  author_id: number | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

const typeLabels: Record<string, string> = {
  notice: "通知",
  announcement: "公告",
  maintenance: "维护",
};

const typeIcons: Record<string, React.ReactNode> = {
  notice: <Info className="w-4 h-4" />,
  announcement: <Megaphone className="w-4 h-4" />,
  maintenance: <AlertTriangle className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  notice: "bg-blue-100 text-blue-700 border-blue-200",
  announcement: "bg-green-100 text-green-700 border-green-200",
  maintenance: "bg-orange-100 text-orange-700 border-orange-200",
};

const priorityLabels: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

export default function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterPublished, setFilterPublished] = useState<string>("");

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "notice" as "notice" | "announcement" | "maintenance",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    is_published: 0,
    start_time: "",
    end_time: "",
  });

  // 详情对话框
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAnn, setDetailAnn] = useState<Announcement | null>(null);

  // 加载通知公告数据
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (filterType) params.set("type", filterType);
      if (filterPublished) params.set("is_published", filterPublished);

      const res = await fetch(`/api/admin/announcements?${params}`);
      const data = await res.json();
      if (data.success) {
        setAnnouncements(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("加载通知公告失败:", error);
      toast.error("加载通知公告失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterType, filterPublished]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // 新增
  const handleAdd = () => {
    setEditingAnn(null);
    setFormData({
      title: "",
      content: "",
      type: "notice",
      priority: "normal",
      is_published: 0,
      start_time: "",
      end_time: "",
    });
    setDialogOpen(true);
  };

  // 编辑
  const handleEdit = (ann: Announcement) => {
    setEditingAnn(ann);
    setFormData({
      title: ann.title,
      content: ann.content,
      type: ann.type,
      priority: ann.priority,
      is_published: ann.is_published,
      start_time: ann.start_time ? ann.start_time.slice(0, 16) : "",
      end_time: ann.end_time ? ann.end_time.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  // 保存
  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("标题不能为空");
      return;
    }
    if (!formData.content.trim()) {
      toast.error("内容不能为空");
      return;
    }

    try {
      const method = editingAnn ? "PUT" : "POST";
      const body = editingAnn ? { id: editingAnn.id, ...formData } : formData;

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/announcements", {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingAnn ? "通知公告已更新" : "通知公告已创建");
        setDialogOpen(false);
        fetchAnnouncements();
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch (error) {
      console.error("保存失败:", error);
      toast.error("保存失败");
    }
  };

  // 发布/取消发布
  const togglePublished = async (ann: Announcement) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ...ann, is_published: ann.is_published ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(ann.is_published ? "已取消发布" : "已发布");
        fetchAnnouncements();
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 删除
  const handleDelete = async (ann: Announcement) => {
    if (!confirm(`确定要删除"${ann.title}"吗？`)) return;

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/announcements?id=${ann.id}`, { method: "DELETE", headers: csrfHeaders });
      const data = await res.json();
      if (data.success) {
        toast.success("已删除");
        fetchAnnouncements();
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除失败");
    }
  };

  // 查看详情
  const viewDetail = (ann: Announcement) => {
    setDetailAnn(ann);
    setDetailOpen(true);
  };

  // 过滤搜索
  const filteredAnnouncements = announcements.filter(ann =>
    !searchTerm || ann.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-ink)]">通知公告</h2>
          <p className="text-sm text-[var(--color-mute)] mt-1">管理系统的通知、公告和维护信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnnouncements}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            新增公告
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
          <Input
            placeholder="搜索标题..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(val) => setFilterType(val || "")}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部类型</SelectItem>
            <SelectItem value="notice">通知</SelectItem>
            <SelectItem value="announcement">公告</SelectItem>
            <SelectItem value="maintenance">维护</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPublished} onValueChange={(val) => setFilterPublished(val || "")}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部状态</SelectItem>
            <SelectItem value="1">已发布</SelectItem>
            <SelectItem value="0">草稿</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 公告列表 */}
      <div className="grid gap-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-mute)]">
            暂无通知公告
          </div>
        ) : (
          filteredAnnouncements.map(ann => (
            <Card key={ann.id} className={`border-l-4 ${typeColors[ann.type].split(" ")[2] || ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColors[ann.type].split(" ")[0]} ${typeColors[ann.type].split(" ")[1]}`}>
                      {typeIcons[ann.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm truncate ${!ann.is_published ? "text-[var(--color-mute)]" : "text-[var(--color-ink)]"}`}>
                          {ann.title}
                        </span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[ann.type]}`}>
                          {typeLabels[ann.type]}
                        </Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[ann.priority]}`}>
                          {priorityLabels[ann.priority]}
                        </Badge>
                        {ann.is_published ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">
                            已发布
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600">
                            草稿
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-mute)] mt-1 line-clamp-1">
                        {ann.content.slice(0, 100)}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--color-mute)]">
                        {ann.author_name && (
                          <span>发布人: {ann.author_name}</span>
                        )}
                        <span>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(ann.created_at).toLocaleDateString()}
                        </span>
                        {ann.start_time && (
                          <span>生效: {new Date(ann.start_time).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => viewDetail(ann)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4 text-[var(--color-mute)]" />
                    </button>
                    <button
                      onClick={() => togglePublished(ann)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
                      title={ann.is_published ? "取消发布" : "发布"}
                    >
                      <Send className={`w-4 h-4 ${ann.is_published ? "text-green-500" : "text-[var(--color-mute)]"}`} />
                    </button>
                    <button
                      onClick={() => handleEdit(ann)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4 text-[var(--color-mute)]" />
                    </button>
                    <button
                      onClick={() => handleDelete(ann)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-[var(--color-mute)]">
            第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingAnn ? "编辑通知公告" : "新增通知公告"}</DialogTitle>
            <DialogDescription>
              {editingAnn ? "修改通知公告的内容和状态" : "创建新的通知或公告"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="请输入通知公告标题"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) =>
                    setFormData(prev => ({ ...prev, type: (val || "notice") as "notice" | "announcement" | "maintenance" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notice">通知</SelectItem>
                    <SelectItem value="announcement">公告</SelectItem>
                    <SelectItem value="maintenance">维护</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) =>
                    setFormData(prev => ({ ...prev, priority: (val || "normal") as "low" | "normal" | "high" | "urgent" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="normal">普通</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="请输入通知公告内容"
                rows={6}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>生效开始时间</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>生效结束时间</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_published === 1}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, is_published: checked ? 1 : 0 }))
                }
              />
              <Label className="text-sm">立即发布</Label>
              {!formData.is_published && (
                <span className="text-xs text-[var(--color-mute)]">保存为草稿</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              {editingAnn ? "保存修改" : "创建公告"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailAnn && typeIcons[detailAnn.type]}
              {detailAnn?.title}
            </DialogTitle>
            <DialogDescription>
              {detailAnn && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[detailAnn.type]}`}>
                    {typeLabels[detailAnn.type]}
                  </Badge>
                  <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[detailAnn.priority]}`}>
                    {priorityLabels[detailAnn.priority]}
                  </Badge>
                  {detailAnn.is_published ? (
                    <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700">已发布</Badge>
                  ) : (
                    <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600">草稿</Badge>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="text-sm text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">
              {detailAnn?.content}
            </div>
            {detailAnn && (detailAnn.start_time || detailAnn.end_time) && (
              <div className="mt-4 p-3 bg-[var(--color-surface-soft)] rounded-lg text-xs text-[var(--color-mute)]">
                {detailAnn.start_time && <span>生效开始: {new Date(detailAnn.start_time).toLocaleString()}</span>}
                {detailAnn.end_time && <span className="ml-4">生效结束: {new Date(detailAnn.end_time).toLocaleString()}</span>}
              </div>
            )}
            {detailAnn?.author_name && (
              <div className="mt-2 text-xs text-[var(--color-mute)]">
                发布人: {detailAnn.author_name} | 创建时间: {new Date(detailAnn.created_at).toLocaleString()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              关闭
            </Button>
            {detailAnn && (
              <Button variant="outline" onClick={() => {
                setDetailOpen(false);
                handleEdit(detailAnn);
              }}>
                <Pencil className="w-4 h-4 mr-1" />
                编辑
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}