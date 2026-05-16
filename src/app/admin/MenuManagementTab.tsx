"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  MenuIcon,
  FolderTree,
  MousePointerClick,
  Search,
  RefreshCw,
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface MenuItem {
  id: number;
  parent_id: number;
  name: string;
  path: string;
  icon: string;
  sort_order: number;
  is_visible: number;
  is_enabled: number;
  type: "directory" | "menu" | "button";
  permission: string;
  component: string;
  created_at: string;
  updated_at: string;
  children?: MenuItem[];
}

const iconOptions = [
  "LayoutDashboard", "ImageIcon", "ShieldCheck", "Users", "FolderTree",
  "Bell", "FileText", "Settings", "Bug", "BarChart3", "Trophy",
  "Mail", "MenuIcon", "UserCog", "Megaphone", "Search",
  "ChevronRight", "Home", "Star", "Heart", "Download",
];

const typeLabels: Record<string, string> = {
  directory: "目录",
  menu: "菜单",
  button: "按钮",
};

const typeColors: Record<string, string> = {
  directory: "bg-blue-100 text-blue-700",
  menu: "bg-green-100 text-green-700",
  button: "bg-orange-100 text-orange-700",
};

export default function MenuManagementTab() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [flatMenus, setFlatMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    parent_id: 0,
    name: "",
    path: "",
    icon: "",
    sort_order: 0,
    is_visible: 1,
    is_enabled: 1,
    type: "menu" as "directory" | "menu" | "button",
    permission: "",
    component: "",
  });

  // 加载菜单数据
  const fetchMenus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/menus");
      const data = await res.json();
      if (data.success) {
        setMenus(data.data);
        setFlatMenus(data.flat);
        // 默认展开所有目录
        const dirIds = data.data.map((m: MenuItem) => m.id);
        setExpandedIds(new Set(dirIds));
      }
    } catch (error) {
      console.error("加载菜单失败:", error);
      toast.error("加载菜单失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  // 切换展开/折叠
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 新增菜单
  const handleAdd = (parentId: number = 0) => {
    setEditingMenu(null);
    setFormData({
      parent_id: parentId,
      name: "",
      path: "",
      icon: "",
      sort_order: 0,
      is_visible: 1,
      is_enabled: 1,
      type: "menu",
      permission: "",
      component: "",
    });
    setDialogOpen(true);
  };

  // 编辑菜单
  const handleEdit = (menu: MenuItem) => {
    setEditingMenu(menu);
    setFormData({
      parent_id: menu.parent_id,
      name: menu.name,
      path: menu.path,
      icon: menu.icon,
      sort_order: menu.sort_order,
      is_visible: menu.is_visible,
      is_enabled: menu.is_enabled,
      type: menu.type,
      permission: menu.permission,
      component: menu.component,
    });
    setDialogOpen(true);
  };

  // 保存菜单
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("菜单名称不能为空");
      return;
    }

    try {
      const url = editingMenu ? "/api/admin/menus" : "/api/admin/menus";
      const method = editingMenu ? "PUT" : "POST";
      const body = editingMenu ? { id: editingMenu.id, ...formData } : formData;

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingMenu ? "菜单已更新" : "菜单已创建");
        setDialogOpen(false);
        fetchMenus();
        window.dispatchEvent(new CustomEvent("admin:menu-changed"));
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch (error) {
      console.error("保存菜单失败:", error);
      toast.error("保存菜单失败");
    }
  };

  // 删除菜单
  const handleDelete = async (menu: MenuItem) => {
    if (menu.children && menu.children.length > 0) {
      toast.error("该菜单下有子菜单，无法删除");
      return;
    }

    if (!confirm(`确定要删除菜单"${menu.name}"吗？`)) return;

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/menus?id=${menu.id}`, { method: "DELETE", headers: csrfHeaders });
      const data = await res.json();
      if (data.success) {
        toast.success("菜单已删除");
        fetchMenus();
        window.dispatchEvent(new CustomEvent("admin:menu-changed"));
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch (error) {
      console.error("删除菜单失败:", error);
      toast.error("删除菜单失败");
    }
  };

  // 切换启用/禁用
  const toggleEnabled = async (menu: MenuItem) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ...menu, is_enabled: menu.is_enabled ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(menu.is_enabled ? "菜单已禁用" : "菜单已启用");
        fetchMenus();
        // 通知AdminClient刷新菜单可见性
        window.dispatchEvent(new CustomEvent("admin:menu-changed"));
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 切换显示/隐藏
  const toggleVisible = async (menu: MenuItem) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ...menu, is_visible: menu.is_visible ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(menu.is_visible ? "菜单已隐藏" : "菜单已显示");
        fetchMenus();
        // 通知AdminClient刷新菜单可见性
        window.dispatchEvent(new CustomEvent("admin:menu-changed"));
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 渲染树形菜单项
  const renderMenuItem = (menu: MenuItem, depth: number = 0) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isExpanded = expandedIds.has(menu.id);
    const matchesSearch = searchTerm
      ? menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        menu.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        menu.permission.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    // 搜索时，如果子菜单匹配，父菜单也要显示
    const childMatches = hasChildren && menu.children!.some(child => 
      matchesSearchItem(child, searchTerm)
    );

    if (searchTerm && !matchesSearch && !childMatches) return null;

    return (
      <div key={menu.id}>
        <div
          className={`flex items-center gap-2 py-2.5 px-3 rounded-lg transition-all hover:bg-[var(--color-surface-soft)] group ${
            !menu.is_enabled ? "opacity-50" : ""
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {/* 展开/折叠 */}
          <button
            onClick={() => hasChildren && toggleExpand(menu.id)}
            className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${
              hasChildren ? "cursor-pointer" : "cursor-default"
            }`}
          >
            {hasChildren ? (
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-mute)]" />
            )}
          </button>

          {/* 类型图标 */}
          <div className="w-5 h-5 flex-shrink-0 text-[var(--color-mute)]">
            {menu.type === "directory" && <FolderTree className="w-4 h-4" />}
            {menu.type === "menu" && <MenuIcon className="w-4 h-4" />}
            {menu.type === "button" && <MousePointerClick className="w-4 h-4" />}
          </div>

          {/* 名称 */}
          <span className={`font-medium text-sm flex-1 ${!menu.is_visible ? "text-[var(--color-mute)] line-through" : "text-[var(--color-ink)]"}`}>
            {menu.name}
          </span>

          {/* 类型标签 */}
          <Badge className={`${typeColors[menu.type]} text-[10px] px-1.5 py-0`}>
            {typeLabels[menu.type]}
          </Badge>

          {/* 路径 */}
          {menu.path && (
            <span className="text-xs text-[var(--color-mute)] max-w-[120px] truncate">
              {menu.path}
            </span>
          )}

          {/* 排序 */}
          <span className="text-xs text-[var(--color-mute)] w-8 text-center">
            {menu.sort_order}
          </span>

          {/* 状态标签 */}
          <div className="flex items-center gap-1">
            {!menu.is_visible && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700">
                隐藏
              </Badge>
            )}
            {!menu.is_enabled && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                禁用
              </Badge>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => toggleVisible(menu)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-soft)] transition-colors"
              title={menu.is_visible ? "隐藏" : "显示"}
            >
              {menu.is_visible ? (
                <Eye className="w-3.5 h-3.5 text-[var(--color-mute)]" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-yellow-500" />
              )}
            </button>
            <button
              onClick={() => toggleEnabled(menu)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-soft)] transition-colors"
              title={menu.is_enabled ? "禁用" : "启用"}
            >
              {menu.is_enabled ? (
                <ToggleRight className="w-4 h-4 text-green-500" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-red-400" />
              )}
            </button>
            {menu.type !== "button" && (
              <button
                onClick={() => handleAdd(menu.id)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-soft)] transition-colors"
                title="新增子菜单"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--color-mute)]" />
              </button>
            )}
            <button
              onClick={() => handleEdit(menu)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-surface-soft)] transition-colors"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5 text-[var(--color-mute)]" />
            </button>
            <button
              onClick={() => handleDelete(menu)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        </div>

        {/* 子菜单 */}
        {hasChildren && isExpanded && (
          <div>
            {menu.children!.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // 搜索匹配递归检查
  const matchesSearchItem = (menu: MenuItem, term: string): boolean => {
    if (!term) return true;
    const lower = term.toLowerCase();
    if (menu.name.toLowerCase().includes(lower)) return true;
    if (menu.path.toLowerCase().includes(lower)) return true;
    if (menu.permission.toLowerCase().includes(lower)) return true;
    if (menu.children) {
      return menu.children.some(child => matchesSearchItem(child, term));
    }
    return false;
  };

  // 获取可选的父菜单（仅目录类型）
  const parentOptions = flatMenus.filter(m => m.type === "directory");

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-ink)]">菜单管理</h2>
          <p className="text-sm text-[var(--color-mute)] mt-1">管理系统菜单的结构、显示和权限</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMenus}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Button size="sm" onClick={() => handleAdd(0)}>
            <Plus className="w-4 h-4 mr-1" />
            新增菜单
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
          <Input
            placeholder="搜索菜单名称、路径或权限..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 菜单树 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">菜单结构</CardTitle>
            <div className="flex items-center gap-3 text-xs text-[var(--color-mute)]">
              <span>共 {flatMenus.length} 个菜单项</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
            </div>
          ) : menus.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-mute)]">
              暂无菜单数据
            </div>
          ) : (
            <div className="space-y-0.5">
              {menus.map(menu => renderMenuItem(menu))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingMenu ? "编辑菜单" : "新增菜单"}</DialogTitle>
            <DialogDescription>
              {editingMenu ? "修改菜单的属性和状态" : "添加新的菜单项到系统中"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* 菜单类型 */}
            <div className="space-y-2">
              <Label>菜单类型</Label>
              <Select
                value={formData.type}
                onValueChange={(val) =>
                  setFormData(prev => ({ ...prev, type: (val || "menu") as "directory" | "menu" | "button" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="directory">目录</SelectItem>
                  <SelectItem value="menu">菜单</SelectItem>
                  <SelectItem value="button">按钮</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 父菜单 */}
            <div className="space-y-2">
              <Label>上级菜单</Label>
              <Select
                value={String(formData.parent_id)}
                onValueChange={(val) =>
                  setFormData(prev => ({ ...prev, parent_id: Number(val) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">顶级菜单</SelectItem>
                  {parentOptions.map(menu => (
                    <SelectItem key={menu.id} value={String(menu.id)}>
                      {menu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 菜单名称 */}
            <div className="space-y-2">
              <Label>菜单名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入菜单名称"
              />
            </div>

            {/* 路由路径 */}
            <div className="space-y-2">
              <Label>路由路径</Label>
              <Input
                value={formData.path}
                onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                placeholder="例如: users 或 /admin/users"
              />
            </div>

            {/* 图标 */}
            <div className="space-y-2">
              <Label>图标</Label>
              <Select
                value={formData.icon}
                onValueChange={(val) => setFormData(prev => ({ ...prev, icon: val || "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择图标" />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map(icon => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 排序和权限 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>权限标识</Label>
                <Input
                  value={formData.permission}
                  onChange={(e) => setFormData(prev => ({ ...prev, permission: e.target.value }))}
                  placeholder="例如: system:menu"
                />
              </div>
            </div>

            {/* 组件路径 */}
            {formData.type === "menu" && (
              <div className="space-y-2">
                <Label>组件路径</Label>
                <Input
                  value={formData.component}
                  onChange={(e) => setFormData(prev => ({ ...prev, component: e.target.value }))}
                  placeholder="例如: UsersTab"
                />
              </div>
            )}

            {/* 状态开关 */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_visible === 1}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, is_visible: checked ? 1 : 0 }))
                  }
                />
                <Label className="text-sm">显示</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_enabled === 1}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, is_enabled: checked ? 1 : 0 }))
                  }
                />
                <Label className="text-sm">启用</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              {editingMenu ? "保存修改" : "创建菜单"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}