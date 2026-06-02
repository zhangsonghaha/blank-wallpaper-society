"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  GripVertical,
  Loader2,
  Image as ImageIcon,
  X,
  Search,
  ImagePlus,
  Star,
  Check,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { withCsrfHeader } from "@/lib/csrf-client";

interface ThemeZone {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  categories: string[];
  tags?: string[];
  enabled: boolean;
  sort_order: number;
  cover_image_id?: number;
}

interface ZoneWithStats extends ThemeZone {
  image_count: number;
  manual_image_count?: number;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
  count: number;
}

interface TagOption {
  tag: string;
  count: number;
}

interface ImageItem {
  id: number;
  title: string;
  thumbnail_url: string;
  url: string;
  width: number;
  height: number;
  category: string;
}

export default function ThemeZonesTab() {
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ThemeZone | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [popularTags, setPopularTags] = useState<TagOption[]>([]);

  // 图片选择器状态
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [imagePickerZone, setImagePickerZone] = useState<ZoneWithStats | null>(null);
  const [imagePickerMode, setImagePickerMode] = useState<"add" | "cover">("add");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchZones();
    fetchOptions();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await fetch("/api/admin/theme-zones");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setZones(data.data || []);
    } catch (error) {
      toast.error("加载主题专区失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/admin/theme-zones/options");
      if (!res.ok) throw new Error("加载选项失败");
      const data = await res.json();
      setCategories(data.categories || []);
      setPopularTags(data.popular_tags || []);
    } catch (error) {
      console.error("Failed to fetch options:", error);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setZones((items) => {
        const oldIndex = items.findIndex((i) => i.key === active.id);
        const newIndex = items.findIndex((i) => i.key === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        return newItems.map((item, index) => ({ ...item, sort_order: index }));
      });
      toast.success("顺序已更新，记得保存");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const zonesToSave = zones.map(({ key, title, subtitle, icon, categories, tags, enabled, sort_order, cover_image_id }) => ({
        key, title, subtitle, icon, categories,
        tags: tags || [], enabled, sort_order, cover_image_id,
      }));
      const res = await fetch("/api/admin/theme-zones", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ zones: zonesToSave }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "保存失败");
      }
      toast.success("保存成功");
      fetchZones();
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (key: string) => {
    setZones((prev) =>
      prev.map((zone) => zone.key === key ? { ...zone, enabled: !zone.enabled } : zone)
    );
    toast.success("状态已更新，记得保存");
  };

  const handleDelete = (key: string) => {
    if (!confirm("确定要删除这个主题专区吗？")) return;
    setZones((prev) => prev.filter((zone) => zone.key !== key));
    toast.success("已删除，记得保存");
  };

  const handleEdit = (zone: ThemeZone) => {
    setEditingZone(zone);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingZone(null);
    setDialogOpen(true);
  };

  const handleDialogSave = async (zoneData: ThemeZone) => {
    // 计算新的 zones 列表
    let updatedZones: ZoneWithStats[];
    if (editingZone) {
      updatedZones = zones.map((z) => (z.key === editingZone.key ? { ...z, ...zoneData } : z));
    } else {
      const newZone: ZoneWithStats = {
        ...zoneData,
        image_count: 0,
        manual_image_count: 0,
        cover_url: null,
        cover_thumbnail_url: null,
        sort_order: zones.length,
      };
      updatedZones = [...zones, newZone];
    }

    // 先更新本地状态
    setZones(updatedZones);
    setDialogOpen(false);
    setEditingZone(null);

    // 自动持久化到数据库
    try {
      const zonesToSave = updatedZones.map(({ key, title, subtitle, icon, categories, tags, enabled, sort_order, cover_image_id }) => ({
        key, title, subtitle, icon, categories,
        tags: tags || [], enabled, sort_order, cover_image_id,
      }));
      const res = await fetch("/api/admin/theme-zones", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ zones: zonesToSave }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "保存失败");
      }
      toast.success(editingZone ? "已更新" : "已创建");
      fetchZones();
    } catch (error: any) {
      toast.error(error.message || "保存失败，请重试");
    }
  };

  const handleOpenImagePicker = (zone: ZoneWithStats, mode: "add" | "cover") => {
    setImagePickerZone(zone);
    setImagePickerMode(mode);
    setImagePickerOpen(true);
  };

  const handleSetCover = (imageId: number) => {
    if (!imagePickerZone) return;
    setZones((prev) =>
      prev.map((z) => z.key === imagePickerZone.key ? { ...z, cover_image_id: imageId } : z)
    );
    setImagePickerOpen(false);
    toast.success("封面已设置，记得保存");
  };

  const handleClearCover = (zoneKey: string) => {
    setZones((prev) =>
      prev.map((z) => z.key === zoneKey ? { ...z, cover_image_id: undefined } : z)
    );
    toast.success("封面已清除，记得保存");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const enabledZones = zones.filter((z) => z.enabled !== false);
  const disabledZones = zones.filter((z) => z.enabled === false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">主题专区管理</h1>
          <p className="text-muted-foreground mt-1">
            管理前台首页展示的主题专区，支持拖拽排序、自定义封面和手动添加图片
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新增专区
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            保存更改
          </Button>
        </div>
      </div>

      {enabledZones.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">启用中 ({enabledZones.length})</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={enabledZones.map((z) => z.key)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {enabledZones.map((zone) => (
                  <ZoneCard
                    key={zone.key}
                    zone={zone}
                    onEdit={() => handleEdit(zone)}
                    onToggleEnabled={() => handleToggleEnabled(zone.key)}
                    onDelete={() => handleDelete(zone.key)}
                    onAddImages={() => handleOpenImagePicker(zone, "add")}
                    onSetCover={() => handleOpenImagePicker(zone, "cover")}
                    onClearCover={() => handleClearCover(zone.key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {disabledZones.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
            已禁用 ({disabledZones.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {disabledZones.map((zone) => (
              <ZoneCard
                key={zone.key}
                zone={zone}
                onEdit={() => handleEdit(zone)}
                onToggleEnabled={() => handleToggleEnabled(zone.key)}
                onDelete={() => handleDelete(zone.key)}
                onAddImages={() => handleOpenImagePicker(zone, "add")}
                onSetCover={() => handleOpenImagePicker(zone, "cover")}
                onClearCover={() => handleClearCover(zone.key)}
              />
            ))}
          </div>
        </div>
      )}

      {zones.length === 0 && (
        <div className="text-center py-16">
          <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无主题专区</h3>
          <p className="text-muted-foreground mb-4">点击上方按钮创建第一个主题专区</p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新增专区
          </Button>
        </div>
      )}

      <ZoneDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingZone(null); }}
        onSave={handleDialogSave}
        zone={editingZone}
        categories={categories}
        popularTags={popularTags}
      />

      <ImagePickerDialog
        open={imagePickerOpen}
        onClose={() => { setImagePickerOpen(false); setImagePickerZone(null); }}
        zone={imagePickerZone}
        mode={imagePickerMode}
        onSetCover={handleSetCover}
        onRefresh={fetchZones}
      />
    </div>
  );
}

// ==================== ZoneCard 组件 ====================
interface ZoneCardProps {
  zone: ZoneWithStats;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onAddImages: () => void;
  onSetCover: () => void;
  onClearCover: () => void;
}

function ZoneCard({ zone, onEdit, onToggleEnabled, onDelete, onAddImages, onSetCover, onClearCover }: ZoneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.key });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-card border rounded-lg overflow-hidden ${isDragging ? "opacity-50 shadow-lg" : ""} ${zone.enabled === false ? "opacity-60" : ""}`}
    >
      <div {...attributes} {...listeners} className="absolute top-2 left-2 cursor-grab active:cursor-grabbing z-10">
        <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground" />
      </div>

      <div className="aspect-video bg-muted relative overflow-hidden">
        {zone.cover_thumbnail_url || zone.cover_url ? (
          <img src={zone.cover_thumbnail_url || zone.cover_url || ""} alt={zone.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 text-3xl">{zone.icon}</div>
        {zone.cover_image_id && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-xs bg-black/60 text-white">自定义封面</Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg mb-1">{zone.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{zone.subtitle}</p>
        </div>

        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{zone.image_count} 张图片</span>
          {zone.manual_image_count ? (
            <span className="text-primary">({zone.manual_image_count} 张手动添加)</span>
          ) : null}
        </div>

        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 text-xs">
            <Edit className="w-3 h-3 mr-1" />编辑
          </Button>
          <Button variant="outline" size="sm" onClick={onAddImages} className="flex-1 text-xs">
            <ImagePlus className="w-3 h-3 mr-1" />图片
          </Button>
          <Button variant="outline" size="sm" onClick={onSetCover} className="text-xs">
            <Star className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex gap-1">
          <Button
            variant={zone.enabled === false ? "default" : "outline"}
            size="sm"
            onClick={onToggleEnabled}
            className="flex-1 text-xs"
          >
            {zone.enabled === false ? <><Power className="w-3 h-3 mr-1" />启用</> : <><PowerOff className="w-3 h-3 mr-1" />禁用</>}
          </Button>
          {zone.cover_image_id && (
            <Button variant="outline" size="sm" onClick={onClearCover} className="text-xs" title="清除自定义封面">
              <X className="w-3 h-3" />
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={onDelete} className="shrink-0 text-destructive hover:text-destructive h-7 w-7">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==================== ZoneDialog 编辑对话框 ====================
interface ZoneDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (zone: ThemeZone) => void;
  zone: ThemeZone | null;
  categories: CategoryOption[];
  popularTags: TagOption[];
}

function ZoneDialog({ open, onClose, onSave, zone, categories, popularTags }: ZoneDialogProps) {
  const [formData, setFormData] = useState<ThemeZone>({
    key: "", title: "", subtitle: "", icon: "🎨",
    categories: [], tags: [], enabled: true, sort_order: 0,
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (zone) {
      setFormData({ ...zone, enabled: zone.enabled !== false, tags: zone.tags || [] });
    } else {
      setFormData({ key: "", title: "", subtitle: "", icon: "🎨", categories: [], tags: [], enabled: true, sort_order: 0 });
    }
  }, [zone, open]);

  const handleSubmit = () => {
    if (!formData.key || !formData.title || !formData.subtitle) {
      toast.error("请填写必填字段");
      return;
    }
    if (formData.categories.length === 0) {
      toast.error("请至少选择一个分类");
      return;
    }
    onSave(formData);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData({ ...formData, tags: [...(formData.tags || []), tag] });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter((t) => t !== tag) || [] });
  };

  const handleToggleCategory = (categoryId: string) => {
    const newCategories = formData.categories.includes(categoryId)
      ? formData.categories.filter((c) => c !== categoryId)
      : [...formData.categories, categoryId];
    setFormData({ ...formData, categories: newCategories });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{zone ? "编辑主题专区" : "新增主题专区"}</DialogTitle>
          <DialogDescription>{zone ? "修改主题专区的配置" : "创建一个新的主题专区"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Key（唯一标识）*</Label>
            <Input value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="例如：cyberpunk（小写字母和数字）" disabled={!!zone} />
          </div>

          <div className="space-y-2">
            <Label>标题 *</Label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例如：赛博朋克" />
          </div>

          <div className="space-y-2">
            <Label>副标题 *</Label>
            <Input value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="例如：霓虹闪烁的未来都市" />
          </div>

          <div className="space-y-2">
            <Label>图标（Emoji）*</Label>
            <Input value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="🎨" className="w-20" />
          </div>

          <div className="space-y-2">
            <Label>关联分类 *（可多选，最多5个）</Label>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {categories.map((cat) => (
                <Badge key={cat.id}
                  variant={formData.categories.includes(cat.id) ? "default" : "outline"}
                  className="cursor-pointer" onClick={() => handleToggleCategory(cat.id)}>
                  {cat.name} ({cat.count})
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>自定义标签（可选，最多10个）</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="输入标签后回车" className="flex-1" />
              <Button onClick={handleAddTag} variant="outline">添加</Button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                  </Badge>
                ))}
              </div>
            )}
            {popularTags.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">热门标签：</p>
                <div className="flex flex-wrap gap-1">
                  {popularTags.slice(0, 10).map((t) => (
                    <Badge key={t.tag} variant="outline" className="cursor-pointer text-xs"
                      onClick={() => {
                        if (!formData.tags?.includes(t.tag)) {
                          setFormData({ ...formData, tags: [...(formData.tags || []), t.tag] });
                        }
                      }}>
                      {t.tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" id="enabled" checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} className="h-4 w-4" />
            <Label htmlFor="enabled">启用状态</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== ImagePickerDialog 图片选择器 ====================
interface ImagePickerDialogProps {
  open: boolean;
  onClose: () => void;
  zone: ZoneWithStats | null;
  mode: "add" | "cover";
  onSetCover: (imageId: number) => void;
  onRefresh: () => void;
}

function ImagePickerDialog({ open, onClose, zone, mode, onSetCover, onRefresh }: ImagePickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchResults, setSearchResults] = useState<ImageItem[]>([]);
  const [manualImages, setManualImages] = useState<ImageItem[]>([]);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open && zone) {
      fetchManualImages();
      fetchCategoryOptions();
      setSearchQuery("");
      setSearchCategory("");
      setSearchResults([]);
      setSelectedImages([]);
    }
  }, [open, zone]);

  const fetchCategoryOptions = async () => {
    try {
      const res = await fetch("/api/admin/theme-zones/options");
      if (res.ok) {
        const data = await res.json();
        setCategoryOptions(data.categories || []);
      }
    } catch {
      // 静默失败，使用空分类列表
    }
  };

  const fetchManualImages = async () => {
    if (!zone) return;
    setLoadingManual(true);
    try {
      const res = await fetch(`/api/admin/theme-zones/images?zone_key=${zone.key}`);
      const data = await res.json();
      setManualImages((data.data || []).map((item: any) => ({
        id: item.image_id,
        title: item.title,
        thumbnail_url: item.thumbnail_url,
        url: item.url,
        width: item.width,
        height: item.height,
        category: item.category,
      })));
    } catch (error) {
      console.error("Failed to fetch manual images:", error);
    } finally {
      setLoadingManual(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery && !searchCategory) {
      toast.error("请输入搜索关键词或选择分类");
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (searchCategory) params.set("category", searchCategory);
      params.set("limit", "100");

      const res = await fetch(`/api/images?${params.toString()}`);
      if (!res.ok) throw new Error("搜索失败");
      const data = await res.json();
      setSearchResults(data.images || data.data || []);
    } catch (error) {
      console.error("Search failed:", error);
      toast.error("搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const isManualImage = (imageId: number) => manualImages.some((img) => img.id === imageId);

  // 可选的图片（排除已添加的）
  const selectableResults = searchResults.filter((img) => !isManualImage(img.id));

  const handleSelectAll = () => {
    const allSelectableIds = selectableResults.map((img) => img.id);
    const allSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedImages.includes(id));
    if (allSelected) {
      // 取消全选
      setSelectedImages((prev) => prev.filter((id) => !allSelectableIds.includes(id)));
    } else {
      // 全选（合并已有选择）
      setSelectedImages((prev) => {
        const merged = new Set([...prev, ...allSelectableIds]);
        return Array.from(merged);
      });
    }
  };

  const handleAddSelected = async () => {
    if (!zone || selectedImages.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/theme-zones/images", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ zone_key: zone.key, image_ids: selectedImages }),
      });
      if (!res.ok) throw new Error("添加失败");
      toast.success(`已添加 ${selectedImages.length} 张图片`);
      setSelectedImages([]);
      setSearchResults([]);
      fetchManualImages();
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveImage = async (imageId: number) => {
    if (!zone) return;
    try {
      await fetch("/api/admin/theme-zones/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ zone_key: zone.key, image_ids: [imageId] }),
      });
      toast.success("已移除");
      fetchManualImages();
      onRefresh();
    } catch (error) {
      toast.error("移除失败");
    }
  };

  const toggleSelect = (imageId: number) => {
    setSelectedImages((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  // 全选状态
  const allSelectableIds = selectableResults.map((img) => img.id);
  const isAllSelected = allSelectableIds.length > 0 && allSelectableIds.every((id) => selectedImages.includes(id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "cover" ? `选择封面图 - ${zone?.title}` : `管理图片 - ${zone?.title}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "cover" ? "选择一张图片作为专区封面" : "搜索并批量添加图片到此专区，或管理已添加的图片"}
          </DialogDescription>
        </DialogHeader>

        {/* 手动添加的图片列表 */}
        {mode === "add" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">已手动添加的图片 ({manualImages.length})</h3>
              {loadingManual && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            {manualImages.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                {manualImages.map((img) => (
                  <div key={img.id} className="relative group aspect-square rounded overflow-hidden border">
                    <img src={img.thumbnail_url || img.url} alt={img.title} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无手动添加的图片</p>
            )}
          </div>
        )}

        {/* 封面选择模式 - 显示手动图片供选择 */}
        {mode === "cover" && manualImages.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">从已添加的图片中选择封面</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {manualImages.map((img) => (
                <div key={img.id}
                  className={`relative group aspect-square rounded overflow-hidden border cursor-pointer ${zone?.cover_image_id === img.id ? "border-primary ring-2 ring-primary" : ""}`}
                  onClick={() => onSetCover(img.id)}>
                  <img src={img.thumbnail_url || img.url} alt={img.title} className="w-full h-full object-cover" />
                  {zone?.cover_image_id === img.id && (
                    <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                      <Star className="w-6 h-6 text-white fill-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搜索区域 */}
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-semibold text-sm">
            {mode === "cover" ? "或从所有图片中搜索封面" : "搜索并批量添加图片"}
          </h3>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="border rounded px-3 py-1 text-sm bg-background"
            >
              <option value="">所有分类</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.count})</option>
              ))}
            </select>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {/* 搜索结果与批量操作 */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {/* 批量操作工具栏 */}
              {mode === "add" && (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs gap-1"
                    >
                      {isAllSelected ? (
                        <><CheckSquare className="w-4 h-4 text-primary" />取消全选</>
                      ) : (
                        <><Square className="w-4 h-4" />全选</>
                      )}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      搜索结果 {searchResults.length} 张
                      {selectableResults.length < searchResults.length && (
                        <span className="ml-1">（{searchResults.length - selectableResults.length} 张已添加）</span>
                      )}
                    </span>
                  </div>
                  {selectedImages.length > 0 && (
                    <Button
                      size="sm"
                      onClick={handleAddSelected}
                      disabled={adding}
                      className="gap-1"
                    >
                      {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      批量添加选中 ({selectedImages.length})
                    </Button>
                  )}
                </div>
              )}

              {/* 图片网格 */}
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-64 overflow-y-auto">
                {searchResults.map((img) => {
                  const alreadyAdded = isManualImage(img.id);
                  const isSelected = selectedImages.includes(img.id);
                  return (
                    <div
                      key={img.id}
                      className={`relative aspect-square rounded overflow-hidden border-2 cursor-pointer transition-all
                        ${isSelected ? "border-primary ring-2 ring-primary" : alreadyAdded ? "border-transparent opacity-50" : "border-transparent hover:border-muted-foreground/30"}`}
                      onClick={() => {
                        if (mode === "cover") {
                          onSetCover(img.id);
                        } else if (!alreadyAdded) {
                          toggleSelect(img.id);
                        }
                      }}
                    >
                      <img src={img.thumbnail_url || img.url} alt={img.title} className="w-full h-full object-cover" />
                      {/* 复选框指示器（仅添加模式） */}
                      {mode === "add" && !alreadyAdded && (
                        <div className={`absolute top-1 left-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                          ${isSelected ? "bg-primary border-primary" : "bg-black/30 border-white/60"}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                      )}
                      {/* 已添加标记 */}
                      {alreadyAdded && mode === "add" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="text-white text-xs">已添加</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === "add" && selectedImages.length > 0 && (
            <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span>已选 {selectedImages.length} 张图片</span>
            </div>
          )}
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
