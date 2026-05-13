"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
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
  MoreHorizontal,
  Download,
  ChevronLeft,
  ChevronRight,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export default function AdminClient() {
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

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    title: "",
    description: "",
    author: "",
    tags: "",
    category: "",
  });
  const [previewUrl, setPreviewUrl] = useState("");

  const [stats, setStats] = useState({
    totalImages: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalCategories: 0,
  });

  const limit = 12;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const [imagesRes, categoriesRes] = await Promise.all([
        fetch(`/api/images?${params}`),
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
  }, [page, searchQuery, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm((prev) => ({ ...prev, file }));
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadForm.file);
      fd.append("title", uploadForm.title);
      fd.append("description", uploadForm.description);
      fd.append("author", uploadForm.author);
      fd.append("tags", uploadForm.tags);
      fd.append("category", uploadForm.category);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();

      if (res.ok) {
        toast.success("上传成功", {
          description: `${result.title} 已上传到服务器`,
        });
        setUploadOpen(false);
        setUploadForm({
          file: null,
          title: "",
          description: "",
          author: "",
          tags: "",
          category: "",
        });
        setPreviewUrl("");
        setPage(1);
        loadData();
      } else {
        toast.error("上传失败", { description: result.error });
      }
    } catch (err) {
      toast.error("上传失败", { description: "网络错误" });
    }
    setUploading(false);
  };

  const handleDelete = async (image: ImageRecord) => {
    try {
      const res = await fetch(`/api/images/${image.id}`, { method: "DELETE" });
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
      await fetch(`/api/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: image.is_favorite ? 0 : 1 }),
      });
      loadData();
    } catch (err) {
      console.error("切换收藏失败:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-soft)]">
      <Toaster position="top-right" richColors />

      <div className="bg-white border-b sticky top-16 z-30">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-ink)]">
                管理后台
              </h1>
              <p className="text-sm text-[var(--color-mute)] mt-0.5">
                管理你的图片资源
              </p>
            </div>
            <Button
              onClick={() => setUploadOpen(true)}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
            >
              <Upload className="w-4 h-4" />
              上传图片
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-mute)]">图片总数</p>
                <p className="text-xl font-bold">
                  {loading ? <Skeleton className="w-12 h-6" /> : stats.totalImages}
                </p>
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
                <p className="text-xl font-bold">
                  {loading ? <Skeleton className="w-12 h-6" /> : stats.totalViews}
                </p>
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
                <p className="text-xl font-bold">
                  {loading ? <Skeleton className="w-12 h-6" /> : stats.totalFavorites}
                </p>
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
                <p className="text-xl font-bold">
                  {loading ? <Skeleton className="w-12 h-6" /> : stats.totalCategories}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>图片管理</CardTitle>
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
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
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[300px]">图片</TableHead>
                        <TableHead>分类</TableHead>
                        <TableHead>尺寸</TableHead>
                        <TableHead>大小</TableHead>
                        <TableHead>
                          <div className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> 浏览
                          </div>
                        </TableHead>
                        <TableHead>上传时间</TableHead>
                        <TableHead className="w-[80px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {images.map((image) => (
                        <TableRow
                          key={image.id}
                          className="cursor-pointer hover:bg-[var(--color-surface-soft)]"
                          onClick={() => {
                            setSelectedImage(image);
                            setDetailOpen(true);
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
                                <img
                                  src={image.thumbnail_url || image.url}
                                  alt={image.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[200px]">
                                  {image.title}
                                </p>
                                <p className="text-xs text-[var(--color-mute)] truncate max-w-[200px]">
                                  {image.author || "未知作者"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
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
                          <TableCell className="text-sm text-[var(--color-mute)]">
                            {image.width}×{image.height}
                          </TableCell>
                          <TableCell className="text-sm text-[var(--color-mute)]">
                            {formatSize(image.file_size)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
                              {image.view_count}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[var(--color-mute)]">
                            {formatDate(image.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(image);
                                }}
                              >
                                <Heart
                                  className={`w-4 h-4 ${
                                    image.is_favorite
                                      ? "fill-red-500 text-red-500"
                                      : "text-[var(--color-mute)]"
                                  }`}
                                />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="outline-none">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuLabel>操作</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(image.url, "_blank");
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    查看原图
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-500 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(image);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-[var(--color-mute)]">
                    共 {total} 张图片，第 {page}/{totalPages} 页
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
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">上传图片</DialogTitle>
            <DialogDescription>
              支持 JPG、PNG、WebP、GIF 格式，单文件最大 20MB
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              <div>
                <Label className="mb-2 block">选择图片 *</Label>
                <div
                  className="border-2 border-dashed border-[var(--color-hairline)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                  onClick={() => document.getElementById("upload-file")?.click()}
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
                    id="upload-file"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">标题</Label>
                  <Input
                    id="title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="图片标题"
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="desc">描述</Label>
                  <Textarea
                    id="desc"
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="图片描述"
                    className="mt-1 h-20 rounded-xl resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="author">作者</Label>
                    <Input
                      id="author"
                      value={uploadForm.author}
                      onChange={(e) => setUploadForm((p) => ({ ...p, author: e.target.value }))}
                      placeholder="作者名"
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cat">分类</Label>
                    <Select
                      value={uploadForm.category}
                      onValueChange={(v) => setUploadForm((p) => ({ ...p, category: v || "" }))}
                    >
                      <SelectTrigger id="cat" className="mt-1 h-10 rounded-xl">
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
                  <Label htmlFor="tags">标签</Label>
                  <Input
                    id="tags"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm((p) => ({ ...p, tags: e.target.value }))}
                    placeholder="逗号分隔，如: 自然,风景"
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadOpen(false)} className="rounded-full">
                取消
              </Button>
              <Button type="submit" disabled={uploading || !uploadForm.file} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2">
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    上传到服务器
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
    </div>
  );
}