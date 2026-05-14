"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ==================== 类型定义 ==================== */

interface Category {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
  image_count?: number;
}

/* ==================== 分类管理组件 ==================== */

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    sort_order: 0,
  });

  /* ==================== 数据加载 ==================== */

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, imgRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/images?limit=1&showAll=true"),
      ]);
      const catData = await catRes.json();

      // 获取每个分类的图片数量
      const imageCounts: Record<string, number> = {};
      if (imgRes.ok) {
        // 通过单独请求获取所有分类的图片统计
        try {
          const statsRes = await fetch("/api/admin/stats");
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            if (statsData.categoryDistribution) {
              statsData.categoryDistribution.forEach((item: { slug: string; count: number }) => {
                imageCounts[item.slug] = item.count;
              });
            }
          }
        } catch {
          // 静默失败
        }
      }

      const enrichedCategories = (catData || []).map((cat: Category) => ({
        ...cat,
        image_count: imageCounts[cat.slug] || 0,
      }));

      setCategories(enrichedCategories);
    } catch (err) {
      console.error("加载分类失败:", err);
      toast.error("加载分类失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ==================== 表单操作 ==================== */

  const openCreateDialog = () => {
    setEditingCategory(null);
    setForm({
      name: "",
      slug: "",
      sort_order: categories.length + 1,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (cat: Category) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      sort_order: cat.sort_order,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (cat: Category) => {
    setDeletingCategory(cat);
    setDeleteDialogOpen(true);
  };

  // 自动生成slug
  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingCategory
        ? prev.slug
        : name
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
            .replace(/^-|-$/g, ""),
    }));
  };

  /* ==================== CRUD 操作 ==================== */

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("请输入分类名称");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("请输入分类标识");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.slug.trim())) {
      toast.error("分类标识只能包含小写字母、数字和连字符");
      return;
    }

    setSaving(true);
    try {
      const url = "/api/categories";
      const method = editingCategory ? "PATCH" : "POST";
      const body = editingCategory
        ? { id: editingCategory.id, ...form }
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingCategory ? "更新成功" : "创建成功");
        setDialogOpen(false);
        loadData();
      } else {
        toast.error("操作失败", { description: data.error });
      }
    } catch {
      toast.error("操作失败");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/categories?id=${deletingCategory.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("删除成功");
        setDeleteDialogOpen(false);
        loadData();
      } else {
        toast.error("删除失败", { description: data.error });
      }
    } catch {
      toast.error("删除失败");
    }
    setSaving(false);
  };

  const handleSortChange = async (cat: Category, direction: "up" | "down") => {
    const currentIndex = categories.findIndex((c) => c.id === cat.id);
    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === categories.length - 1)
    ) return;

    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const swapCat = categories[swapIndex];

    try {
      // 并行更新两个分类的排序
      await Promise.all([
        fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cat.id, sort_order: swapCat.sort_order }),
        }),
        fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: swapCat.id, sort_order: cat.sort_order }),
        }),
      ]);
      loadData();
    } catch {
      toast.error("排序更新失败");
    }
  };

  /* ==================== 渲染 ==================== */

  const CATEGORY_COLORS = [
    "bg-emerald-100 text-emerald-700",
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
    "bg-orange-100 text-orange-700",
  ];

  return (
    <div className="space-y-6">
      {/* 统计概览 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <FolderTree className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">分类总数</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : categories.length}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">图片总数</p>
              <div className="text-xl font-bold">
                {loading ? (
                  <Skeleton className="w-12 h-6" />
                ) : (
                  categories.reduce((sum, c) => sum + (c.image_count || 0), 0)
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">空分类</p>
              <div className="text-xl font-bold">
                {loading ? (
                  <Skeleton className="w-12 h-6" />
                ) : (
                  categories.filter((c) => !c.image_count).length
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 分类列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>分类列表</CardTitle>
            <Button
              onClick={openCreateDialog}
              size="sm"
              className="rounded-full"
            >
              <Plus className="w-4 h-4 mr-1" />
              新增分类
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
                <FolderTree className="w-8 h-8 text-[var(--color-ash)]" />
              </div>
              <h3 className="text-lg font-semibold mb-1">暂无分类</h3>
              <p className="text-sm text-[var(--color-mute)] mb-4">
                点击「新增分类」按钮创建第一个分类
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, index) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-4 p-4 rounded-xl border hover:bg-[var(--color-surface-soft)] transition-colors group"
                >
                  {/* 排序把手和箭头 */}
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => handleSortChange(cat, "up")}
                      disabled={index === 0}
                      className="p-0.5 rounded hover:bg-[var(--color-surface-card)] disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-[var(--color-mute)]" />
                    </button>
                    <GripVertical className="w-4 h-4 text-[var(--color-ash)]" />
                    <button
                      onClick={() => handleSortChange(cat, "down")}
                      disabled={index === categories.length - 1}
                      className="p-0.5 rounded hover:bg-[var(--color-surface-card)] disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-[var(--color-mute)]" />
                    </button>
                  </div>

                  {/* 分类信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`rounded-full text-xs ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`}
                      >
                        {cat.name}
                      </Badge>
                      <span className="text-xs text-[var(--color-ash)] font-mono">
                        /{cat.slug}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[var(--color-mute)]">
                        排序: {cat.sort_order}
                      </span>
                      <span className="text-xs text-[var(--color-mute)]">
                        {cat.image_count || 0} 张图片
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => openEditDialog(cat)}
                    >
                      <Pencil className="w-4 h-4 text-[var(--color-mute)]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => openDeleteDialog(cat)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "编辑分类" : "新增分类"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "修改分类信息。注意：更改标识可能影响已有图片的分类关联。"
                : "创建一个新的壁纸分类。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">分类名称</Label>
              <Input
                id="cat-name"
                placeholder="例如：自然风光"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">分类标识 (slug)</Label>
              <Input
                id="cat-slug"
                placeholder="例如：nature"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                      .replace(/--+/g, "-"),
                  }))
                }
                className="rounded-lg font-mono"
              />
              <p className="text-xs text-[var(--color-ash)]">
                只能包含小写字母、数字和连字符，用于URL路径
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-order">排序</Label>
              <Input
                id="cat-order"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    sort_order: parseInt(e.target.value) || 0,
                  }))
                }
                className="rounded-lg w-32"
              />
              <p className="text-xs text-[var(--color-ash)]">
                数字越小越靠前
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full"
            >
              {saving ? "保存中..." : editingCategory ? "保存修改" : "创建分类"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除分类「{deletingCategory?.name}」吗？该操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          {deletingCategory && (deletingCategory.image_count || 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
              该分类下有 {deletingCategory.image_count} 张图片，需要先移除或更改这些图片的分类后才能删除。
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || (deletingCategory?.image_count || 0) > 0}
              className="rounded-full"
            >
              {saving ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}