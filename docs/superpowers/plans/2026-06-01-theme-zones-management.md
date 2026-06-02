# 主题专区管理功能实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为管理后台添加完整的主题专区管理功能，支持创建、编辑、删除、排序和启用/禁用主题专区。

**架构：** 基于现有的 `system_settings` 表存储 JSON 配置，前端使用卡片式布局展示，支持拖拽排序。API 提供 CRUD 操作接口，前端组件集成到现有管理后台的 Tab 架构中。

**技术栈：** Next.js App Router、React、TypeScript、shadcn/ui、@dnd-kit、MySQL、Tailwind CSS

---

## 文件结构

### 新增文件

| 文件路径 | 职责 | 估计行数 |
|---------|------|---------|
| `src/app/api/admin/theme-zones/route.ts` | 主题专区 CRUD API（GET/PUT） | ~250 |
| `src/app/api/admin/theme-zones/options/route.ts` | 获取可用分类和标签选项 | ~100 |
| `src/app/admin/ThemeZonesTab.tsx` | 主题专区管理主组件 | ~700 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/app/admin/AdminClient.tsx` | 导入 ThemeZonesTab 组件并添加到 switchTab |
| `package.json` | 安装 @dnd-kit 依赖 |

---

## 任务分解

### 任务 1：环境准备与依赖安装

**目标：** 安装必要的依赖包，确保开发环境就绪。

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：安装 @dnd-kit 依赖**

```bash
cd e:\next_package\blank-wallpaper-society
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **步骤 2：验证安装**

```bash
pnpm list @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

预期输出：显示已安装的版本号

- [ ] **步骤 3：提交依赖变更**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @dnd-kit dependencies for drag-and-drop"
```

---

### 任务 2：创建管理端 API - 获取主题专区列表

**目标：** 实现 `GET /api/admin/theme-zones` 接口，返回所有主题专区及统计信息。

**文件：**
- 创建：`src/app/api/admin/theme-zones/route.ts`

- [ ] **步骤 1：创建 API 路由文件**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/admin/theme-zones - 获取所有主题专区（管理端）
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 从 system_settings 读取主题专区配置
    const settings = (await query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'theme_zones'"
    )) as any[];

    let zones: any[] = [];
    if (settings.length > 0 && settings[0].setting_value) {
      try {
        zones = JSON.parse(settings[0].setting_value);
      } catch {
        zones = [];
      }
    }

    // 默认主题专区
    if (zones.length === 0) {
      zones = [
        { key: "nature", title: "自然风光", subtitle: "山川湖海，四季轮转", category: "nature", icon: "🏔️", enabled: true, sort_order: 0 },
        { key: "minimal", title: "极简美学", subtitle: "少即是多，留白之美", category: "minimal", icon: "✨", enabled: true, sort_order: 1 },
        { key: "city", title: "城市建筑", subtitle: "钢铁森林，光影交错", category: "city", icon: "🏙️", enabled: true, sort_order: 2 },
        { key: "art", title: "艺术创作", subtitle: "灵感无限，创意无界", category: "art", icon: "🎨", enabled: true, sort_order: 3 },
      ];
    }

    // 为每个主题专区获取统计信息
    const zonesWithData = await Promise.all(
      zones.map(async (zone: any) => {
        try {
          // 构建查询条件
          const conditions: string[] = [];
          const params: any[] = [];

          conditions.push("i.status = 'approved'");
          conditions.push("i.media_type != 'video'");

          // 多分类匹配
          if (zone.categories && Array.isArray(zone.categories) && zone.categories.length > 0) {
            const placeholders = zone.categories.map(() => "?").join(", ");
            conditions.push(`i.category IN (${placeholders})`);
            params.push(...zone.categories);
          } else if (zone.category) {
            // 兼容旧版单分类
            conditions.push("i.category = ?");
            params.push(zone.category);
          }

          // 标签匹配（可选）
          if (zone.tags && Array.isArray(zone.tags) && zone.tags.length > 0) {
            const tagConditions = zone.tags.map(() => "i.tags LIKE ?").join(" OR ");
            conditions.push(`(${tagConditions})`);
            params.push(...zone.tags.map((tag: string) => `%${tag}%`));
          }

          const whereClause = conditions.join(" AND ");

          // 查询图片数量
          const [countResult] = (await query(
            `SELECT COUNT(*) as total FROM images i WHERE ${whereClause}`,
            params
          )) as any[];

          // 查询封面图（下载量最高的图片）
          const coverImages = (await query(
            `SELECT i.id, i.url, i.thumbnail_url, i.width, i.height
            FROM images i
            WHERE ${whereClause}
            ORDER BY i.download_count DESC, i.view_count DESC
            LIMIT 1`,
            params
          )) as any[];

          return {
            ...zone,
            categories: zone.categories || (zone.category ? [zone.category] : []),
            image_count: countResult?.total || 0,
            cover_url: coverImages[0]?.url || null,
            cover_thumbnail_url: coverImages[0]?.thumbnail_url || null,
          };
        } catch (error) {
          console.error(`Error fetching data for zone ${zone.key}:`, error);
          return {
            ...zone,
            categories: zone.categories || (zone.category ? [zone.category] : []),
            image_count: 0,
            cover_url: null,
            cover_thumbnail_url: null,
          };
        }
      })
    );

    // 计算统计信息
    const stats = {
      total: zonesWithData.length,
      enabled: zonesWithData.filter(z => z.enabled !== false).length,
      disabled: zonesWithData.filter(z => z.enabled === false).length,
    };

    return NextResponse.json({ data: zonesWithData, stats });
  } catch (error: any) {
    console.error("GET /api/admin/theme-zones error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}

// PUT /api/admin/theme-zones - 更新主题专区配置
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    const body = await request.json();
    const { zones } = body;

    // 验证输入
    if (!Array.isArray(zones)) {
      return NextResponse.json({ error: "zones 必须为数组" }, { status: 400 });
    }

    if (zones.length > 8) {
      return NextResponse.json({ error: "主题专区最多 8 个" }, { status: 400 });
    }

    // 验证每个专区
    const keyRegex = /^[a-z0-9]{2,30}$/;
    const keys = new Set<string>();

    for (const zone of zones) {
      if (!zone.key || !zone.title) {
        return NextResponse.json({ error: "每个专区必须有 key 和 title" }, { status: 400 });
      }

      if (!keyRegex.test(zone.key)) {
        return NextResponse.json({ error: `Key "${zone.key}" 格式无效，必须为小写字母和数字，长度 2-30` }, { status: 400 });
      }

      if (keys.has(zone.key)) {
        return NextResponse.json({ error: `存在重复的 Key: "${zone.key}"` }, { status: 400 });
      }
      keys.add(zone.key);

      if (zone.title.length < 1 || zone.title.length > 50) {
        return NextResponse.json({ error: `标题 "${zone.title}" 长度必须在 1-50 字符之间` }, { status: 400 });
      }

      if (zone.subtitle && (zone.subtitle.length < 1 || zone.subtitle.length > 100)) {
        return NextResponse.json({ error: `副标题 "${zone.subtitle}" 长度必须在 1-100 字符之间` }, { status: 400 });
      }

      if (!zone.categories || !Array.isArray(zone.categories) || zone.categories.length === 0) {
        return NextResponse.json({ error: `专区 "${zone.title}" 必须至少关联一个分类` }, { status: 400 });
      }

      if (zone.categories.length > 5) {
        return NextResponse.json({ error: `专区 "${zone.title}" 最多关联 5 个分类` }, { status: 400 });
      }

      if (zone.tags && Array.isArray(zone.tags) && zone.tags.length > 10) {
        return NextResponse.json({ error: `专区 "${zone.title}" 最多 10 个标签` }, { status: 400 });
      }
    }

    // 保存到数据库
    const configValue = JSON.stringify(zones);

    await query(
      `INSERT INTO system_settings (setting_key, setting_value, description)
       VALUES ('theme_zones', ?, '主题专区配置')
       ON DUPLICATE KEY UPDATE setting_value = ?`,
      [configValue, configValue]
    );

    return NextResponse.json({ 
      message: "主题专区配置已更新", 
      updated_count: zones.length 
    });
  } catch (error: any) {
    console.error("PUT /api/admin/theme-zones error:", error);
    return NextResponse.json({ error: error.message || "更新失败" }, { status: 500 });
  }
}
```

- [ ] **步骤 2：测试 API**

在浏览器中访问：`http://localhost:3000/api/admin/theme-zones`（需要先登录管理员账号）

预期：返回 JSON 数据，包含主题专区列表和统计信息

- [ ] **步骤 3：提交代码**

```bash
git add src/app/api/admin/theme-zones/route.ts
git commit -m "feat: add admin theme zones API (GET/PUT)"
```

---

### 任务 3：创建选项数据 API

**目标：** 实现 `GET /api/admin/theme-zones/options` 接口，返回可用分类和热门标签。

**文件：**
- 创建：`src/app/api/admin/theme-zones/options/route.ts`

- [ ] **步骤 1：创建 API 路由文件**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/admin/theme-zones/options - 获取可用分类和标签选项
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }

    // 获取所有分类及其图片数量
    const categories = (await query(
      `SELECT 
        i.category as id, 
        i.category as name, 
        COUNT(*) as count
      FROM images i
      WHERE i.status = 'approved' 
        AND i.media_type != 'video'
        AND i.category IS NOT NULL
        AND i.category != ''
      GROUP BY i.category
      ORDER BY count DESC`
    )) as any[];

    // 获取热门标签（从 tags 字段提取）
    const allTags = (await query(
      `SELECT tags FROM images 
      WHERE status = 'approved' 
        AND media_type != 'video'
        AND tags IS NOT NULL
        AND tags != ''`
    )) as any[];

    // 统计标签频率
    const tagCounts = new Map<string, number>();
    allTags.forEach(row => {
      if (row.tags) {
        // 假设 tags 是逗号分隔的字符串或 JSON 数组
        let tags: string[] = [];
        if (typeof row.tags === 'string') {
          try {
            // 尝试解析 JSON 数组
            tags = JSON.parse(row.tags);
          } catch {
            // 回退到逗号分隔
            tags = row.tags.split(',').map((t: string) => t.trim());
          }
        } else if (Array.isArray(row.tags)) {
          tags = row.tags;
        }

        tags.forEach(tag => {
          if (tag && tag.length > 0) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        });
      }
    });

    // 转换为数组并排序
    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 取前 20 个

    return NextResponse.json({
      categories,
      popular_tags: popularTags,
    });
  } catch (error: any) {
    console.error("GET /api/admin/theme-zones/options error:", error);
    return NextResponse.json({ error: error.message || "获取失败" }, { status: 500 });
  }
}
```

- [ ] **步骤 2：测试 API**

在浏览器中访问：`http://localhost:3000/api/admin/theme-zones/options`

预期：返回分类列表和热门标签

- [ ] **步骤 3：提交代码**

```bash
git add src/app/api/admin/theme-zones/options/route.ts
git commit -m "feat: add theme zones options API"
```

---

### 任务 4：创建主题专区管理主组件 - 基础结构

**目标：** 实现 ThemeZonesTab 组件的基础结构和状态管理。

**文件：**
- 创建：`src/app/admin/ThemeZonesTab.tsx`（第 1-200 行）

- [ ] **步骤 1：创建组件基础结构**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function ThemeZonesTab() {
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ThemeZone | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [popularTags, setPopularTags] = useState<TagOption[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 加载数据
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
        
        // 更新 sort_order
        return newItems.map((item, index) => ({
          ...item,
          sort_order: index,
        }));
      });
      
      toast.success("顺序已更新，记得保存");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const zonesToSave = zones.map(({ key, title, subtitle, icon, categories, tags, enabled, sort_order, cover_image_id }) => ({
        key,
        title,
        subtitle,
        icon,
        categories,
        tags: tags || [],
        enabled,
        sort_order,
        cover_image_id,
      }));

      const res = await fetch("/api/admin/theme-zones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zones: zonesToSave }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "保存失败");
      }

      toast.success("保存成功");
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = (key: string) => {
    setZones((prev) =>
      prev.map((zone) =>
        zone.key === key ? { ...zone, enabled: !zone.enabled } : zone
      )
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

  const handleDialogSave = (zoneData: ThemeZone) => {
    if (editingZone) {
      // 编辑模式
      setZones((prev) =>
        prev.map((z) => (z.key === editingZone.key ? { ...z, ...zoneData } : z))
      );
    } else {
      // 创建模式
      const newZone: ZoneWithStats = {
        ...zoneData,
        image_count: 0,
        cover_url: null,
        cover_thumbnail_url: null,
        sort_order: zones.length,
      };
      setZones((prev) => [...prev, newZone]);
    }
    
    setDialogOpen(false);
    setEditingZone(null);
    toast.success(editingZone ? "已更新" : "已创建，记得保存");
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
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">主题专区管理</h1>
          <p className="text-muted-foreground mt-1">
            管理前台首页展示的主题专区，支持拖拽排序
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新增专区
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            保存更改
          </Button>
        </div>
      </div>

      {/* 启用中的专区 */}
      {enabledZones.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            启用中 ({enabledZones.length})
          </h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={enabledZones.map((z) => z.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {enabledZones.map((zone) => (
                  <ZoneCard
                    key={zone.key}
                    zone={zone}
                    onEdit={() => handleEdit(zone)}
                    onToggleEnabled={() => handleToggleEnabled(zone.key)}
                    onDelete={() => handleDelete(zone.key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* 已禁用的专区 */}
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
              />
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {zones.length === 0 && (
        <div className="text-center py-16">
          <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无主题专区</h3>
          <p className="text-muted-foreground mb-4">
            点击上方按钮创建第一个主题专区
          </p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            新增专区
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **步骤 2：提交基础结构**

```bash
git add src/app/admin/ThemeZonesTab.tsx
git commit -m "feat: add ThemeZonesTab component base structure"
```

---

### 任务 5：创建主题专区卡片组件

**目标：** 实现 ZoneCard 可拖拽卡片组件。

**文件：**
- 修改：`src/app/admin/ThemeZonesTab.tsx`（追加第 201-280 行）

- [ ] **步骤 1：添加 ZoneCard 组件**

```typescript
// ZoneCard 组件（在文件末尾添加）
interface ZoneCardProps {
  zone: ZoneWithStats;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

function ZoneCard({ zone, onEdit, onToggleEnabled, onDelete }: ZoneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: zone.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative bg-card border rounded-lg overflow-hidden
        ${isDragging ? "opacity-50 shadow-lg" : ""}
        ${zone.enabled === false ? "opacity-60" : ""}
      `}
    >
      {/* 拖拽手柄 */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 cursor-grab active:cursor-grabbing z-10"
      >
        <GripVertical className="w-5 h-5 text-muted-foreground hover:text-foreground" />
      </div>

      {/* 封面图 */}
      <div className="aspect-video bg-muted relative overflow-hidden">
        {zone.cover_thumbnail_url || zone.cover_url ? (
          <img
            src={zone.cover_thumbnail_url || zone.cover_url || ""}
            alt={zone.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* 图标叠加 */}
        <div className="absolute bottom-2 right-2 text-3xl">
          {zone.icon}
        </div>
      </div>

      {/* 内容区 */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1">{zone.title}</h3>
        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
          {zone.subtitle}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {zone.image_count} 张图片
        </p>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-1" />
            编辑
          </Button>
          <Button
            variant={zone.enabled === false ? "default" : "outline"}
            size="sm"
            onClick={onToggleEnabled}
            className="flex-1"
          >
            {zone.enabled === false ? (
              <>
                <Power className="w-4 h-4 mr-1" />
                启用
              </>
            ) : (
              <>
                <PowerOff className="w-4 h-4 mr-1" />
                禁用
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onDelete}
            className="shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：提交卡片组件**

```bash
git add src/app/admin/ThemeZonesTab.tsx
git commit -m "feat: add ZoneCard draggable component"
```

---

### 任务 6：创建编辑对话框组件

**目标：** 实现主题专区的创建/编辑对话框。

**文件：**
- 修改：`src/app/admin/ThemeZonesTab.tsx`（追加第 281-550 行）

- [ ] **步骤 1：添加对话框组件**

由于代码较长，这里提供关键部分：

```typescript
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
import { X } from "lucide-react";

// ZoneDialog 组件（在文件末尾添加）
interface ZoneDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (zone: ThemeZone) => void;
  zone: ThemeZone | null;
  categories: CategoryOption[];
  popularTags: TagOption[];
}

function ZoneDialog({
  open,
  onClose,
  onSave,
  zone,
  categories,
  popularTags,
}: ZoneDialogProps) {
  const [formData, setFormData] = useState<ThemeZone>({
    key: "",
    title: "",
    subtitle: "",
    icon: "🎨",
    categories: [],
    tags: [],
    enabled: true,
    sort_order: 0,
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (zone) {
      setFormData(zone);
    } else {
      setFormData({
        key: "",
        title: "",
        subtitle: "",
        icon: "🎨",
        categories: [],
        tags: [],
        enabled: true,
        sort_order: 0,
      });
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
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tag],
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag) || [],
    });
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
          <DialogDescription>
            {zone ? "修改主题专区的配置" : "创建一个新的主题专区"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <Label>Key（唯一标识）*</Label>
            <Input
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="例如：cyberpunk（小写字母和数字）"
              disabled={!!zone}
            />
          </div>

          <div className="space-y-2">
            <Label>标题 *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例如：赛博朋克"
            />
          </div>

          <div className="space-y-2">
            <Label>副标题 *</Label>
            <Input
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="例如：霓虹闪烁的未来都市"
            />
          </div>

          <div className="space-y-2">
            <Label>图标（Emoji）*</Label>
            <Input
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              placeholder="🎨"
              className="w-20"
            />
          </div>

          {/* 分类选择 */}
          <div className="space-y-2">
            <Label>关联分类 *（可多选，最多5个）</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant={formData.categories.includes(cat.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleToggleCategory(cat.id)}
                >
                  {cat.name} ({cat.count})
                </Badge>
              ))}
            </div>
          </div>

          {/* 标签输入 */}
          <div className="space-y-2">
            <Label>自定义标签（可选，最多10个）</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                placeholder="输入标签后回车"
                className="flex-1"
              />
              <Button onClick={handleAddTag} variant="outline">
                添加
              </Button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 启用状态 */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="enabled">启用状态</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **步骤 2：在 ThemeZonesTab 中集成对话框**

在 ThemeZonesTab 组件的 return 语句末尾添加：

```typescript
      {/* 编辑对话框 */}
      <ZoneDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingZone(null);
        }}
        onSave={handleDialogSave}
        zone={editingZone}
        categories={categories}
        popularTags={popularTags}
      />
    </div>
  );
}
```

- [ ] **步骤 3：提交对话框组件**

```bash
git add src/app/admin/ThemeZonesTab.tsx
git commit -m "feat: add ZoneDialog component for create/edit"
```

---

### 任务 7：集成到管理后台

**目标：** 将 ThemeZonesTab 组件集成到管理后台的 Tab 系统中。

**文件：**
- 修改：`src/app/admin/AdminClient.tsx`

- [ ] **步骤 1：导入 ThemeZonesTab 组件**

在 AdminClient.tsx 的导入区域添加：

```typescript
import ThemeZonesTab from "./ThemeZonesTab";
```

- [ ] **步骤 2：添加到 switchTab 函数**

在 AdminClient.tsx 的 switchTab 函数中添加 case（大约在第 250 行附近）：

```typescript
      case "theme-zones":
        content = <ThemeZonesTab />;
        break;
```

- [ ] **步骤 3：提交集成代码**

```bash
git add src/app/admin/AdminClient.tsx
git commit -m "feat: integrate ThemeZonesTab into admin panel"
```

---

### 任务 8：测试与验证

**目标：** 完整测试所有功能，确保符合验收标准。

**文件：**
- 无新增文件

- [ ] **步骤 1：启动开发服务器**

```bash
pnpm dev
```

- [ ] **步骤 2：测试功能清单**

在浏览器中访问管理后台，测试以下功能：

- [ ] 查看所有主题专区列表
- [ ] 创建新的主题专区
- [ ] 编辑现有主题专区
- [ ] 删除主题专区
- [ ] 启用/禁用主题专区
- [ ] 拖拽调整顺序
- [ ] 保存更改
- [ ] 前台首页正确展示主题专区

- [ ] **步骤 3：运行构建检查**

```bash
pnpm build
```

预期：构建成功，无错误

- [ ] **步骤 4：提交所有更改**

```bash
git add .
git commit -m "feat: complete theme zones management feature"
```

---

## 验收标准检查清单

### 功能验收
- [ ] 可以查看所有主题专区列表
- [ ] 可以创建新的主题专区
- [ ] 可以编辑现有主题专区
- [ ] 可以删除主题专区
- [ ] 可以启用/禁用主题专区
- [ ] 可以拖拽调整顺序
- [ ] 编辑时可以实时预览（通过表单预览数据）
- [ ] 前台首页正确展示主题专区

### 性能验收
- [ ] 页面加载时间 < 2s
- [ ] API 响应时间 < 500ms
- [ ] 拖拽操作流畅无卡顿

### 用户体验
- [ ] 界面美观，符合现有设计风格
- [ ] 操作反馈及时（Toast 提示）
- [ ] 错误提示清晰易懂
- [ ] 移动端适配良好

---

## 部署检查清单

- [ ] 所有依赖已安装
- [ ] 代码已提交到 Git
- [ ] 构建成功（`pnpm build`）
- [ ] 本地测试通过
- [ ] 推送到远程仓库
- [ ] 生产环境部署
- [ ] 生产环境验证

---

**计划版本历史：**

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| 1.0 | 2026-06-01 | 初始版本 | AI Assistant |
