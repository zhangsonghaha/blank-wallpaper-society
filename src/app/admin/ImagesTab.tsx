"use client";

import { useState, useEffect, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Upload,
  Search,
  Trash2,
  Heart,
  Eye,
  Calendar,
  Image as ImageIcon,
  Tag,
  FolderOpen,
  Download,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  ExternalLink,
  ZoomIn,
  Pencil,
  Copy,
  AlertTriangle,
  Layers,
} from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface ImageRecord {
  id: number;
  title: string;
  description: string;
  filename: string;
  storage_key: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  author: string;
  tags: string;
  category: string;
  is_favorite: number;
  view_count: number;
  created_at: string;
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

const getCategoryLabel = (slug: string, categories: Category[]) => {
  const cat = categories.find((c) => c.slug === slug);
  return cat ? cat.name : slug;
};

export default function ImagesTab() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    url: "",
    title: "",
    description: "",
    author: "",
    tags: "",
    category: "",
  });
  const [previewUrl, setPreviewUrl] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: 0,
    title: "",
    description: "",
    author: "",
    tags: "",
    category: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // 重复检测相关状态
  const [activeTab, setActiveTab] = useState<"list" | "duplicates">("list");
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateDeleteIds, setDuplicateDeleteIds] = useState<Set<number>>(new Set());
  const [duplicateDeleting, setDuplicateDeleting] = useState(false);

  // 变体生成相关状态
  const [variantGenerating, setVariantGenerating] = useState(false);
  const [variantStatus, setVariantStatus] = useState<{
    totalImages: number;
    withVariants: number;
    withoutVariants: number;
    progress: number;
  } | null>(null);

  const [stats, setStats] = useState({
    totalImages: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalCategories: 0,
  });

  const [pageSize, setPageSize] = useState(12);
  const [jumpPage, setJumpPage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const [imagesRes, categoriesRes] = await Promise.all([
        fetch(`/api/images?${params}&showAll=true`),
        fetch("/api/categories"),
      ]);

      const imagesData = await imagesRes.json();
      const categoriesData = await categoriesRes.json();

      setImages(imagesData.data || []);
      setTotal(imagesData.total || 0);
      setTotalPages(imagesData.totalPages || 1);
      setCategories(categoriesData || []);

      setStats({
        totalImages: imagesData.total || 0,
        totalViews: (imagesData.data || []).reduce(
          (sum: number, img: ImageRecord) => sum + (img.view_count || 0),
          0
        ),
        totalFavorites: (imagesData.data || []).filter(
          (img: ImageRecord) => img.is_favorite
        ).length,
        totalCategories: categoriesData.length || 0,
      });
    } catch (err) {
      console.error("加载失败:", err);
    }
    setLoading(false);
  }, [page, searchQuery, categoryFilter, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 首次加载变体状态
  useEffect(() => {
    loadVariantStatus();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm((prev) => ({ ...prev, file }));
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUrlPreview = useCallback(async () => {
    if (!uploadForm.url) return;
    setPreviewUrl(uploadForm.url);
  }, [uploadForm.url]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let res;

      if (uploadMode === "url") {
        if (!uploadForm.url) {
          toast.error("请输入图片链接");
          setUploading(false);
          return;
        }
        res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: uploadForm.url,
            title: uploadForm.title,
            description: uploadForm.description,
            author: uploadForm.author,
            tags: uploadForm.tags,
            category: uploadForm.category,
          }),
        });
      } else {
        if (!uploadForm.file) {
          toast.error("请选择文件");
          setUploading(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", uploadForm.file);
        fd.append("title", uploadForm.title);
        fd.append("description", uploadForm.description);
        fd.append("author", uploadForm.author);
        fd.append("tags", uploadForm.tags);
        fd.append("category", uploadForm.category);

        res = await fetch("/api/upload", { method: "POST", body: fd });
      }

      const result = await res.json();

      if (res.ok) {
        toast.success("上传成功", {
          description: result.message,
        });
        setUploadOpen(false);
        setUploadForm({
          file: null,
          url: "",
          title: "",
          description: "",
          author: "",
          tags: "",
          category: "",
        });
        setPreviewUrl("");
        setPage(1);
        loadData();
      } else if (res.status === 409) {
        // 重复图片提示
        const dup = result.duplicate;
        toast.error("检测到重复图片", {
          description: `与「${dup?.title || "ID:" + dup?.id}」相似度超过95%，已阻止上传`,
          duration: 5000,
        });
      } else {
        toast.error("上传失败", { description: result.error });
      }
    } catch (err) {
      toast.error("上传失败", { description: "网络错误" });
    }
    setUploading(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length && images.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map(img => img.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/images/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("批量删除成功", { description: data.message });
        setSelectedIds(new Set());
        setBatchDeleteConfirmOpen(false);
        loadData();
      } else {
        toast.error("批量删除失败", { description: data.error });
      }
    } catch (err) {
      toast.error("批量删除失败", { description: "网络错误" });
    }
    setBatchDeleting(false);
  };

  const handleDelete = async (image: ImageRecord) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/images/${image.id}`, { method: "DELETE", headers: { ...csrfHeaders } });
      if (res.ok) {
        toast.success("已删除", { description: `"${image.title}" 已删除` });
        loadData();
        setDetailOpen(false);
      }
    } catch (err) {
      toast.error("删除失败");
    }
  };

  const toggleFavorite = async (image: ImageRecord) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      if (image.is_favorite) {
        await fetch(`/api/favorites/${image.id}`, { method: "DELETE", headers: { ...csrfHeaders } });
      } else {
        await fetch(`/api/favorites/${image.id}`, { method: "POST", headers: { ...csrfHeaders } });
      }
      loadData();
    } catch (err) {
      console.error("切换收藏失败:", err);
    }
  };

  const openEdit = (image: ImageRecord) => {
    setEditForm({
      id: image.id,
      title: image.title,
      description: image.description,
      author: image.author,
      tags: image.tags,
      category: image.category,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editForm.title.trim()) {
      toast.error("标题不能为空");
      return;
    }
    setEditSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/images/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          author: editForm.author,
          tags: editForm.tags,
          category: editForm.category,
        }),
      });
      if (res.ok) {
        toast.success("更新成功");
        setEditOpen(false);
        setDetailOpen(false);
        loadData();
      } else {
        const data = await res.json();
        toast.error("更新失败", { description: data.error });
      }
    } catch (err) {
      toast.error("更新失败", { description: "网络错误" });
    }
    setEditSaving(false);
  };

  // 加载重复图片组
  const loadDuplicates = async () => {
    setDuplicateLoading(true);
    try {
      const res = await fetch("/api/admin/duplicates");
      if (res.ok) {
        const data = await res.json();
        setDuplicateGroups(data.groups || []);
      } else {
        const data = await res.json();
        toast.error("加载重复检测失败", { description: data.error });
      }
    } catch (err) {
      toast.error("加载重复检测失败", { description: "网络错误" });
    }
    setDuplicateLoading(false);
  };

  // 切换重复检测中图片的选中状态
  const toggleDuplicateSelect = (id: number) => {
    setDuplicateDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 批量删除选中的重复图片
  const handleDuplicateDelete = async () => {
    if (duplicateDeleteIds.size === 0) return;
    setDuplicateDeleting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/duplicates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ids: Array.from(duplicateDeleteIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("删除成功", { description: data.message });
        setDuplicateDeleteIds(new Set());
        loadDuplicates();
        loadData();
      } else {
        toast.error("删除失败", { description: data.error });
      }
    } catch (err) {
      toast.error("删除失败", { description: "网络错误" });
    }
    setDuplicateDeleting(false);
  };

  // 加载变体生成状态
  const loadVariantStatus = async () => {
    try {
      const res = await fetch("/api/admin/generate-variants");
      if (res.ok) {
        const data = await res.json();
        setVariantStatus(data);
      }
    } catch (err) {
      console.error("加载变体状态失败:", err);
    }
  };

  // 批量生成变体
  const handleGenerateVariants = async () => {
    setVariantGenerating(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/generate-variants?limit=50", {
        method: "POST",
        headers: { ...csrfHeaders },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("变体生成完成", {
          description: data.message,
          duration: 5000,
        });
        // 刷新状态
        loadVariantStatus();
      } else {
        toast.error("变体生成失败", { description: data.error });
      }
    } catch (err) {
      toast.error("变体生成失败", { description: "网络错误" });
    }
    setVariantGenerating(false);
  };

  // 计算全选 checkbox 状态
  const allChecked = images.length > 0 && selectedIds.size === images.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < images.length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">图片总数</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalImages}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">总浏览</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalViews}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">收藏</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalFavorites}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">分类</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalCategories}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 变体生成进度 */}
      {variantStatus && variantStatus.withoutVariants > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">变体生成进度</p>
                <p className="text-xs text-amber-600">
                  已生成 {variantStatus.withVariants} / {variantStatus.totalImages} 张图片，
                  剩余 {variantStatus.withoutVariants} 张待处理
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32">
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${variantStatus.progress}%` }}
                  />
                </div>
                <p className="text-xs text-amber-600 text-right mt-1">{variantStatus.progress}%</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                disabled={variantGenerating}
                onClick={handleGenerateVariants}
              >
                <Layers className="w-3.5 h-3.5" />
                {variantGenerating ? "生成中..." : "开始生成"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CardTitle>图片管理</CardTitle>
              <div className="flex items-center bg-[var(--color-surface-soft)] rounded-full p-0.5">
                <button
                  onClick={() => setActiveTab("list")}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    activeTab === "list"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-mute)] hover:text-foreground"
                  }`}
                >
                  图片列表
                </button>
                <button
                  onClick={() => {
                    setActiveTab("duplicates");
                    loadDuplicates();
                  }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                    activeTab === "duplicates"
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-mute)] hover:text-foreground"
                  }`}
                >
                  <Copy className="w-3 h-3" />
                  重复检测
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
                <Input
                  placeholder="搜索图片..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 rounded-full text-sm"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  if (v) setCategoryFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-32 h-9 rounded-full text-sm">
                  <SelectValue placeholder="全部分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分类</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-9 gap-1.5 shrink-0"
                disabled={variantGenerating}
                onClick={handleGenerateVariants}
                title="为未生成变体的图片批量生成多分辨率变体"
              >
                <Layers className="w-3.5 h-3.5" />
                {variantGenerating ? "生成中..." : "生成变体"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "duplicates" ? (
            /* 重复检测面板 */
            duplicateLoading ? (
              <div className="space-y-3 py-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            ) : duplicateGroups.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
                  <Copy className="w-8 h-8 text-[var(--color-ash)]" />
                </div>
                <h3 className="text-lg font-semibold mb-1">未发现重复图片</h3>
                <p className="text-sm text-[var(--color-mute)]">
                  所有图片都是唯一的，没有检测到相似图片
                </p>
              </div>
            ) : (
              <>
                {duplicateDeleteIds.size > 0 && (
                  <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-orange-50 rounded-xl border border-orange-200">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      已选择 {duplicateDeleteIds.size} 张待删除
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs h-7"
                      onClick={() => setDuplicateDeleteIds(new Set())}
                    >
                      取消选择
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-full text-xs h-7 gap-1"
                      disabled={duplicateDeleting}
                      onClick={handleDuplicateDelete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {duplicateDeleting ? "删除中..." : "删除选中"}
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {duplicateGroups.map((group, gi) => (
                    <div
                      key={gi}
                      className="border rounded-xl p-4 bg-[var(--color-surface-soft)]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="rounded-full">
                            第 {gi + 1} 组
                          </Badge>
                          <span className="text-xs text-[var(--color-mute)]">
                            {group.images.length} 张相似图片
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full text-xs"
                        >
                          相似度 {group.similarity}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {group.images.map((img: any) => (
                          <div
                            key={img.id}
                            className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                              duplicateDeleteIds.has(img.id)
                                ? "border-red-400 ring-2 ring-red-200"
                                : "border-transparent hover:border-[var(--color-primary)]"
                            }`}
                            onClick={() => toggleDuplicateSelect(img.id)}
                          >
                            <div className="aspect-square bg-[var(--color-surface-card)]">
                              <img
                                src={img.thumbnail_url || img.url}
                                alt={img.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute top-1 left-1">
                              <Checkbox
                                checked={duplicateDeleteIds.has(img.id)}
                                onCheckedChange={() =>
                                  toggleDuplicateSelect(img.id)
                                }
                              />
                            </div>
                            <div className="p-1.5 bg-background/80">
                              <p className="text-xs truncate">{img.title}</p>
                              <p className="text-[10px] text-[var(--color-mute)]">
                                ID: {img.id}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-[var(--color-ash)]" />
              </div>
              <h3 className="text-lg font-semibold mb-1">还没有图片</h3>
              <p className="text-sm text-[var(--color-mute)] mb-4">
                点击右上角"上传图片"按钮开始
              </p>
              <Button
                onClick={() => setUploadOpen(true)}
                variant="outline"
                className="rounded-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                上传第一张图片
              </Button>
            </div>
          ) : (
            <>
              {/* 批量操作栏 */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-blue-50 rounded-xl border border-blue-200">
                  <span className="text-sm font-medium text-blue-700">
                    已选择 {selectedIds.size} 项
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs h-7"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    取消选择
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-full text-xs h-7 gap-1"
                    onClick={() => setBatchDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    批量删除
                  </Button>
                </div>
              )}

              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px] pl-4">
                        <Checkbox
                          checked={someChecked ? "indeterminate" : allChecked}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[260px]">图片</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>尺寸</TableHead>
                      <TableHead>大小</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> 浏览
                        </div>
                      </TableHead>
                      <TableHead>上传时间</TableHead>
                      <TableHead className="w-[140px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {images.map((image) => (
                      <TableRow
                        key={image.id}
                        className={`cursor-pointer hover:bg-[var(--color-surface-soft)] ${selectedIds.has(image.id) ? "bg-blue-50/50" : ""}`}
                      >
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(image.id)}
                            onCheckedChange={() => toggleSelect(image.id)}
                          />
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
                              <img
                                src={image.thumbnail_url || image.url}
                                alt={image.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[180px]">
                                {image.title}
                              </p>
                              <p className="text-xs text-[var(--color-mute)] truncate max-w-[180px]">
                                {image.author || "未知作者"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          {image.category ? (
                            <Badge
                              variant="secondary"
                              className="rounded-full text-xs"
                            >
                              {getCategoryLabel(image.category, categories)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-[var(--color-mute)]">未分类</span>
                          )}
                        </TableCell>
                        <TableCell
                          className="text-sm text-[var(--color-mute)]"
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          {image.width}×{image.height}
                        </TableCell>
                        <TableCell
                          className="text-sm text-[var(--color-mute)]"
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          {formatSize(image.file_size)}
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
                            {image.view_count}
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-sm text-[var(--color-mute)]"
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          {formatDate(image.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8"
                              title="查看"
                              onClick={() => {
                                setSelectedImage(image);
                                setDetailOpen(true);
                              }}
                            >
                              <ZoomIn className="w-4 h-4 text-[var(--color-mute)]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8"
                              title="编辑"
                              onClick={() => openEdit(image)}
                            >
                              <Pencil className="w-4 h-4 text-[var(--color-mute)]" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8"
                              title="删除"
                              onClick={() => handleDelete(image)}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                <div className="flex items-center gap-3 text-sm text-[var(--color-mute)]">
                  <span>共 {total} 张图片</span>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5">
                    <span>每页</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => {
                        setPageSize(Number(v));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-7 w-[70px] rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>条</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
                    })
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("...");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      typeof p === "string" ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-sm text-[var(--color-mute)]">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={p}
                          variant={page === p ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(p)}
                          className={`rounded-full h-8 w-8 p-0 text-xs ${
                            page === p ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)]" : ""
                          }`}
                        >
                          {p}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--color-mute)]">跳至</span>
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      className="h-7 w-[52px] rounded-full text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={jumpPage}
                      onChange={(e) => setJumpPage(e.target.value)}
                      placeholder={`${page}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = Number(jumpPage);
                          if (val >= 1 && val <= totalPages) {
                            setPage(val);
                            setJumpPage("");
                          }
                        }
                      }}
                    />
                    <span className="text-xs text-[var(--color-mute)]">页</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">上传图片</DialogTitle>
            <DialogDescription>
              支持本地文件或网络链接，JPG/PNG/WebP/GIF 格式，单文件最大 20MB
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={uploadMode === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setUploadMode("file");
                setUploadForm((prev) => ({ ...prev, file: null, url: "" }));
                setPreviewUrl("");
              }}
              className="rounded-full gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              本地上传
            </Button>
            <Button
              type="button"
              variant={uploadMode === "url" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setUploadMode("url");
                setUploadForm((prev) => ({ ...prev, file: null, url: "" }));
                setPreviewUrl("");
              }}
              className="rounded-full gap-1"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              网络链接
            </Button>
          </div>

          <form onSubmit={handleUpload}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div>
                <Label className="mb-2 block">
                  {uploadMode === "file" ? "选择图片 *" : "图片链接 *"}
                </Label>
                {uploadMode === "file" ? (
                  <div
                    className="border-2 border-dashed border-[var(--color-hairline)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                    onClick={() => document.getElementById("upload-file-img")?.click()}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="预览"
                        className="max-h-40 mx-auto rounded-lg object-contain"
                      />
                    ) : (
                      <div className="text-[var(--color-mute)]">
                        <Upload className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">点击选择图片</p>
                        <p className="text-xs mt-1">或拖拽文件到此处</p>
                      </div>
                    )}
                    <input
                      id="upload-file-img"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        value={uploadForm.url}
                        onChange={(e) =>
                          setUploadForm((p) => ({ ...p, url: e.target.value }))
                        }
                        placeholder="https://example.com/image.jpg"
                        className="pr-10 h-10"
                      />
                      <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUrlPreview}
                      disabled={!uploadForm.url}
                      className="rounded-full w-full"
                    >
                      预览图片
                    </Button>
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="预览"
                        className="max-h-40 mx-auto rounded-lg object-contain border"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="img-title">标题</Label>
                  <Input
                    id="img-title"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="图片标题"
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="img-desc">描述</Label>
                  <Textarea
                    id="img-desc"
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="图片描述"
                    className="mt-1 h-20 rounded-xl resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="img-author">作者</Label>
                    <Input
                      id="img-author"
                      value={uploadForm.author}
                      onChange={(e) =>
                        setUploadForm((p) => ({ ...p, author: e.target.value }))
                      }
                      placeholder="作者名"
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="img-cat">分类</Label>
                    <Select
                      value={uploadForm.category}
                      onValueChange={(v) =>
                        setUploadForm((p) => ({ ...p, category: v || "" }))
                      }
                    >
                      <SelectTrigger id="img-cat" className="mt-1 h-10 rounded-xl">
                        <SelectValue placeholder="选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="img-tags">标签</Label>
                  <Input
                    id="img-tags"
                    value={uploadForm.tags}
                    onChange={(e) =>
                      setUploadForm((p) => ({ ...p, tags: e.target.value }))
                    }
                    placeholder="逗号分隔，如: 自然,风景"
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadOpen(false)}
                className="rounded-full"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  uploading ||
                  (uploadMode === "file" ? !uploadForm.file : !uploadForm.url)
                }
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
              >
                {uploading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    {uploadMode === "url" ? "抓取中..." : "上传中..."}
                  </>
                ) : (
                  <>
                    {uploadMode === "url" ? (
                      <LinkIcon className="w-4 h-4" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadMode === "url" ? "抓取并上传" : "上传到服务器"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          {selectedImage && (
            <>
              <div className="relative rounded-xl overflow-hidden bg-[var(--color-surface-card)] -mx-6 -mt-6 mb-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="w-full max-h-[50vh] object-contain"
                />
                {selectedImage.is_favorite && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-red-500 gap-1 rounded-full">
                      <Heart className="w-3 h-3 fill-white" />
                      已收藏
                    </Badge>
                  </div>
                )}
              </div>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedImage.title}</DialogTitle>
                {selectedImage.description && (
                  <p className="text-sm text-[var(--color-mute)] mt-1">{selectedImage.description}</p>
                )}
              </DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <Tag className="w-3 h-3" /> 作者
                  </p>
                  <p className="text-sm font-medium">{selectedImage.author || "未知"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" /> 分类
                  </p>
                  <p className="text-sm font-medium">
                    {selectedImage.category ? getCategoryLabel(selectedImage.category, categories) : "未分类"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> 尺寸
                  </p>
                  <p className="text-sm font-medium">{selectedImage.width} × {selectedImage.height}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-mute)]">文件大小</p>
                  <p className="text-sm font-medium">{formatSize(selectedImage.file_size)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <Eye className="w-3 h-3" /> 浏览
                  </p>
                  <p className="text-sm font-medium">{selectedImage.view_count} 次</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> 上传时间
                  </p>
                  <p className="text-sm font-medium">{formatDate(selectedImage.created_at)}</p>
                </div>
              </div>
              {selectedImage.tags && (
                <div className="pb-4">
                  <p className="text-xs text-[var(--color-mute)] mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> 标签
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedImage.tags.split(",").map((tag, i) => (
                      <Badge key={i} variant="secondary" className="rounded-full text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <Separator />
              <div className="flex items-center gap-3 pt-4">
                <Button variant="outline" className="rounded-full gap-2" onClick={() => toggleFavorite(selectedImage)}>
                  <Heart className={`w-4 h-4 ${selectedImage.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
                  {selectedImage.is_favorite ? "取消收藏" : "收藏"}
                </Button>
                <Button variant="outline" className="rounded-full gap-2" onClick={() => {
                  openEdit(selectedImage);
                  setDetailOpen(false);
                }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  编辑
                </Button>
                <Button variant="outline" className="rounded-full gap-2" onClick={() => window.open(selectedImage.url, "_blank")}>
                  <Download className="w-4 h-4" />
                  查看原图
                </Button>
                <Button variant="destructive" className="rounded-full gap-2 ml-auto" onClick={() => handleDelete(selectedImage)}>
                  <Trash2 className="w-4 h-4" />
                  删除
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirm Dialog */}
      <Dialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">确认批量删除</DialogTitle>
            <DialogDescription>
              您确定要删除选中的 {selectedIds.size} 张图片吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setBatchDeleteConfirmOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={batchDeleting}
              onClick={handleBatchDelete}
              className="rounded-full gap-2"
            >
              {batchDeleting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  确认删除 {selectedIds.size} 张图片
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">编辑图片信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-title">标题 *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="图片标题"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="edit-desc">描述</Label>
              <Textarea
                id="edit-desc"
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="图片描述"
                className="mt-1 h-20 rounded-xl resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-author">作者</Label>
                <Input
                  id="edit-author"
                  value={editForm.author}
                  onChange={(e) => setEditForm((p) => ({ ...p, author: e.target.value }))}
                  placeholder="作者名"
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="edit-cat">分类</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, category: v || "" }))}
                >
                  <SelectTrigger id="edit-cat" className="mt-1 h-10 rounded-xl">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-tags">标签</Label>
              <Input
                id="edit-tags"
                value={editForm.tags}
                onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))}
                placeholder="逗号分隔，如: 自然,风景"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              type="button"
              disabled={editSaving}
              onClick={handleEditSave}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
            >
              {editSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  保存中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  保存修改
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}