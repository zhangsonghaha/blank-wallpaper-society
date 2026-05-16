"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  ToggleLeft,
  ToggleRight,
  Search,
  RefreshCw,
  ChevronRight,
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
import { Checkbox } from "@/components/ui/checkbox";

interface Role {
  id: number;
  name: string;
  code: string;
  description: string;
  is_enabled: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  menu_ids: number[];
}

interface MenuOption {
  id: number;
  parent_id: number;
  name: string;
  path?: string;
  children?: MenuOption[];
}

export default function RoleManagementTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    is_enabled: 1,
    sort_order: 0,
    menu_ids: [] as number[],
  });

  // 加载角色和菜单数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, menusRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/admin/menus"),
      ]);
      const rolesData = await rolesRes.json();
      const menusData = await menusRes.json();
      
      if (rolesData.success) setRoles(rolesData.data);
      if (menusData.success) setMenus(menusData.data);
    } catch (error) {
      console.error("加载数据失败:", error);
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 新增角色
  const handleAdd = () => {
    setEditingRole(null);
    setFormData({
      name: "",
      code: "",
      description: "",
      is_enabled: 1,
      sort_order: 0,
      menu_ids: [],
    });
    setDialogOpen(true);
  };

  // 编辑角色
  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description,
      is_enabled: role.is_enabled,
      sort_order: role.sort_order,
      menu_ids: role.menu_ids || [],
    });
    setDialogOpen(true);
  };

  // 保存角色
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("角色名称不能为空");
      return;
    }
    if (!formData.code.trim()) {
      toast.error("角色编码不能为空");
      return;
    }

    try {
      const method = editingRole ? "PUT" : "POST";
      const body = editingRole ? { id: editingRole.id, ...formData } : formData;

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/roles", {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingRole ? "角色已更新" : "角色已创建");
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch (error) {
      console.error("保存角色失败:", error);
      toast.error("保存角色失败");
    }
  };

  // 删除角色
  const handleDelete = async (role: Role) => {
    if (["admin", "moderator", "user"].includes(role.code)) {
      toast.error("内置角色不允许删除");
      return;
    }
    if (!confirm(`确定要删除角色"${role.name}"吗？`)) return;

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/roles?id=${role.id}`, { method: "DELETE", headers: csrfHeaders });
      const data = await res.json();
      if (data.success) {
        toast.success("角色已删除");
        fetchData();
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch (error) {
      toast.error("删除角色失败");
    }
  };

  // 切换启用/禁用
  const toggleEnabled = async (role: Role) => {
    if (["admin"].includes(role.code)) {
      toast.error("超级管理员角色不允许禁用");
      return;
    }
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ...role, is_enabled: role.is_enabled ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(role.is_enabled ? "角色已禁用" : "角色已启用");
        fetchData();
      }
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 菜单权限树 - 全选/反选
  const toggleAllMenus = (parentId: number, checked: boolean) => {
    const menu = menus.find(m => m.id === parentId);
    if (!menu) return;
    const ids = [menu.id];
    if (menu.children) {
      menu.children.forEach(c => ids.push(c.id));
    }
    setFormData(prev => ({
      ...prev,
      menu_ids: checked
        ? [...new Set([...prev.menu_ids, ...ids])]
        : prev.menu_ids.filter(id => !ids.includes(id)),
    }));
  };

  // 单个菜单勾选
  const toggleMenu = (menuId: number, parentId: number, checked: boolean) => {
    setFormData(prev => {
      let newIds = checked
        ? [...prev.menu_ids, menuId]
        : prev.menu_ids.filter(id => id !== menuId);

      // 如果勾选子菜单，自动勾选父菜单
      if (checked && parentId) {
        if (!newIds.includes(parentId)) {
          newIds.push(parentId);
        }
      }

      // 如果取消勾选父菜单，同时取消所有子菜单
      if (!checked) {
        const menu = menus.find(m => m.id === menuId);
        if (menu?.children) {
          const childIds = menu.children.map(c => c.id);
          newIds = newIds.filter(id => !childIds.includes(id));
        }
      }

      return { ...prev, menu_ids: newIds };
    });
  };

  // 过滤角色
  const filteredRoles = roles.filter(role =>
    !searchTerm ||
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 渲染菜单权限选择器
  const renderMenuTree = () => (
    <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-3">
      {menus.map((menu) => {
        const isParentChecked = formData.menu_ids.includes(menu.id);
        const isAllChildrenChecked = menu.children
          ? menu.children.every(c => formData.menu_ids.includes(c.id))
          : true;
        const isSomeChildrenChecked = menu.children
          ? menu.children.some(c => formData.menu_ids.includes(c.id))
          : false;

        return (
          <div key={menu.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={isParentChecked && (menu.children ? isAllChildrenChecked : true)}
                onCheckedChange={(checked) => toggleAllMenus(menu.id, !!checked)}
                className={isSomeChildrenChecked && !isAllChildrenChecked ? "data-[state=checked]:bg-[var(--color-primary)]/50" : ""}
              />
              <span className="font-medium text-sm">{menu.name}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600">
                目录
              </Badge>
            </div>
            {menu.children && (
              <div className="ml-6 space-y-1 pl-2 border-l">
                {menu.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={formData.menu_ids.includes(child.id)}
                      onCheckedChange={(checked) => toggleMenu(child.id, menu.id, !!checked)}
                    />
                    <span className="text-sm text-[var(--color-ink)]">{child.name}</span>
                    {child.id && (
                      <span className="text-[10px] text-[var(--color-mute)]">{child.path || ''}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-ink)]">角色管理</h2>
          <p className="text-sm text-[var(--color-mute)] mt-1">管理系统角色和权限分配</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            新增角色
          </Button>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
          <Input
            placeholder="搜索角色名称或编码..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 角色列表 */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-mute)]">
            暂无角色数据
          </div>
        ) : (
          filteredRoles.map(role => {
            const assignedMenus = menus.reduce((count, m) => {
              if (role.menu_ids?.includes(m.id)) count++;
              m.children?.forEach(c => { if (role.menu_ids?.includes(c.id)) count++; });
              return count;
            }, 0);
            const totalMenus = menus.reduce((count, m) => {
              count++;
              if (m.children) count += m.children.length;
              return count;
            }, 0);

            return (
              <Card key={role.id} className={!role.is_enabled ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        role.code === "admin" ? "bg-red-100" :
                        role.code === "moderator" ? "bg-blue-100" :
                        "bg-gray-100"
                      }`}>
                        <Shield className={`w-5 h-5 ${
                          role.code === "admin" ? "text-red-600" :
                          role.code === "moderator" ? "text-blue-600" :
                          "text-gray-600"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--color-ink)]">{role.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {role.code}
                          </Badge>
                          {["admin", "moderator", "user"].includes(role.code) && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">
                              内置
                            </Badge>
                          )}
                          {!role.is_enabled && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                              已禁用
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-mute)] mt-0.5">
                          {role.description || "无描述"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* 权限统计 */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-[var(--color-ink)]">
                          {assignedMenus}/{totalMenus} 菜单
                        </div>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1">
                          <div
                            className="h-full bg-[var(--color-primary)] rounded-full transition-all"
                            style={{ width: `${(assignedMenus / totalMenus) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleEnabled(role)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
                          title={role.is_enabled ? "禁用" : "启用"}
                        >
                          {role.is_enabled ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-red-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(role)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-soft)] transition-colors"
                          title="编辑"
                        >
                          <Pencil className="w-4 h-4 text-[var(--color-mute)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingRole ? "编辑角色" : "新增角色"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "修改角色信息和权限分配" : "创建新角色并分配菜单权限"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>角色名称 *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如: 运营管理员"
                />
              </div>
              <div className="space-y-2">
                <Label>角色编码 *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="例如: ops_admin"
                  disabled={!!editingRole && ["admin", "moderator", "user"].includes(editingRole.code)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>角色描述</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="简要描述角色的职责"
              />
            </div>

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
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.is_enabled === 1}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, is_enabled: checked ? 1 : 0 }))
                  }
                />
                <Label className="text-sm">启用</Label>
              </div>
            </div>

            {/* 菜单权限分配 */}
            <div className="space-y-2">
              <Label>菜单权限</Label>
              {renderMenuTree()}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              {editingRole ? "保存修改" : "创建角色"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}