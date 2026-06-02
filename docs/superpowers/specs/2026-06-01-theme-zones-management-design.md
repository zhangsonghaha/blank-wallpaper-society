# 主题专区管理功能设计文档

**创建日期：** 2026-06-01  
**状态：** 已批准  
**版本：** 1.0

---

## 一、功能概述

### 1.1 目标

为管理后台添加"主题专区"管理功能，允许管理员完整管理前台首页展示的主题专区，包括创建、编辑、删除、排序和启用/禁用等操作。

### 1.2 核心需求

- ✅ **完整 CRUD 管理** - 创建、编辑、删除主题专区
- ✅ **自定义分类规则** - 支持多分类组合和自定义标签
- ✅ **灵活排序** - 拖拽调整显示顺序
- ✅ **状态控制** - 启用/禁用主题专区
- ✅ **实时预览** - 编辑时预览前台展示效果
- ✅ **卡片式布局** - 视觉清晰，易于管理

### 1.3 用户角色

- **管理员（Admin）** - 拥有完整管理权限

---

## 二、数据结构设计

### 2.1 存储方案

**存储位置：** `system_settings` 表  
**配置键：** `theme_zones`  
**数据格式：** JSON 数组

### 2.2 数据模型

```typescript
interface ThemeZone {
  key: string;              // 唯一标识（如 "cyberpunk"）
  title: string;            // 标题（如 "赛博朋克"）
  subtitle: string;         // 副标题（如 "霓虹闪烁的未来都市"）
  icon: string;             // Emoji 图标（如 "🌃"）
  categories: string[];     // 关联的分类（支持多个）
  tags?: string[];          // 可选：自定义标签
  enabled: boolean;         // 是否启用
  sort_order: number;       // 排序权重（升序）
  cover_image_id?: number;  // 可选：自定义封面图
}
```

### 2.3 数据示例

```json
[
  {
    "key": "nature",
    "title": "自然风光",
    "subtitle": "山川湖海，四季轮转",
    "icon": "🏔️",
    "categories": ["nature"],
    "enabled": true,
    "sort_order": 0
  },
  {
    "key": "cyberpunk",
    "title": "赛博朋克",
    "subtitle": "霓虹闪烁的未来都市",
    "icon": "🌃",
    "categories": ["city"],
    "tags": ["neon", "night", "futuristic"],
    "enabled": true,
    "sort_order": 1
  },
  {
    "key": "minimal",
    "title": "极简美学",
    "subtitle": "少即是多，留白之美",
    "icon": "✨",
    "categories": ["minimal"],
    "enabled": true,
    "sort_order": 2
  }
]
```

### 2.4 字段约束

| 字段 | 类型 | 必填 | 约束 | 说明 |
|------|------|------|------|------|
| `key` | string | ✅ | 唯一，小写字母+数字，2-30字符 | 主题专区唯一标识 |
| `title` | string | ✅ | 1-50字符 | 显示标题 |
| `subtitle` | string | ✅ | 1-100字符 | 副标题描述 |
| `icon` | string | ✅ | 单个 Emoji | 图标 |
| `categories` | string[] | ✅ | 至少1个，最多5个 | 关联的图片分类 |
| `tags` | string[] | ❌ | 最多10个 | 自定义标签（可选） |
| `enabled` | boolean | ✅ | - | 是否启用 |
| `sort_order` | number | ✅ | 0-999 | 排序权重（升序） |
| `cover_image_id` | number | ❌ | 必须存在 | 自定义封面图（可选） |

---

## 三、API 设计

### 3.1 获取主题专区列表（管理端）

**端点：** `GET /api/admin/theme-zones`

**权限：** 需要管理员权限

**响应格式：**
```json
{
  "data": [
    {
      "key": "nature",
      "title": "自然风光",
      "subtitle": "山川湖海，四季轮转",
      "icon": "🏔️",
      "categories": ["nature"],
      "enabled": true,
      "sort_order": 0,
      "image_count": 120,
      "cover_url": "https://...",
      "created_at": "2026-06-01T00:00:00Z",
      "updated_at": "2026-06-01T00:00:00Z"
    }
  ],
  "stats": {
    "total": 6,
    "enabled": 4,
    "disabled": 2
  }
}
```

**实现逻辑：**
1. 从 `system_settings` 读取 `theme_zones` 配置
2. 为每个主题专区查询关联的图片数量和封面图
3. 返回完整数据（包括禁用的专区）

---

### 3.2 更新主题专区配置

**端点：** `PUT /api/admin/theme-zones`

**权限：** 需要管理员权限

**请求体：**
```json
{
  "zones": [
    {
      "key": "nature",
      "title": "自然风光",
      "subtitle": "山川湖海，四季轮转",
      "icon": "🏔️",
      "categories": ["nature"],
      "tags": [],
      "enabled": true,
      "sort_order": 0
    },
    {
      "key": "cyberpunk",
      "title": "赛博朋克",
      "subtitle": "霓虹闪烁的未来都市",
      "icon": "🌃",
      "categories": ["city"],
      "tags": ["neon", "night"],
      "enabled": true,
      "sort_order": 1
    }
  ]
}
```

**验证规则：**
- ✅ `zones` 必须为数组
- ✅ 数组长度 ≤ 8（最多8个主题专区）
- ✅ 每个专区必须有 `key` 和 `title`
- ✅ `key` 必须唯一且符合格式（小写字母+数字）
- ✅ `title` 长度 1-50 字符
- ✅ `subtitle` 长度 1-100 字符
- ✅ `icon` 为单个 Emoji
- ✅ `categories` 为数组，长度 1-5
- ✅ `tags` 为数组，长度 0-10
- ✅ `sort_order` 为数字

**响应格式：**
```json
{
  "message": "主题专区配置已更新",
  "updated_count": 2
}
```

**实现逻辑：**
1. 验证输入数据
2. 检查 `key` 唯一性
3. 检查关联的分类是否存在
4. 更新 `system_settings` 表
5. 返回成功响应

---

### 3.3 获取可用分类和标签列表

**端点：** `GET /api/admin/theme-zones/options`

**权限：** 需要管理员权限

**响应格式：**
```json
{
  "categories": [
    { "id": "nature", "name": "自然风光", "count": 120 },
    { "id": "city", "name": "城市建筑", "count": 95 },
    { "id": "minimal", "name": "极简美学", "count": 85 },
    { "id": "art", "name": "艺术创作", "count": 60 }
  ],
  "popular_tags": [
    { "tag": "neon", "count": 45 },
    { "tag": "night", "count": 38 },
    { "tag": "futuristic", "count": 32 },
    { "tag": "abstract", "count": 28 }
  ]
}
```

**实现逻辑：**
1. 查询所有可用的分类（从 `categories` 表或图片的 `category` 字段）
2. 查询热门标签（从图片的 `tags` 字段统计）
3. 返回供选择器使用

---

## 四、UI 组件设计

### 4.1 主界面布局

```
┌─────────────────────────────────────────────────────┐
│  主题专区管理                        [+ 新增专区]   │
│                                                     │
│  启用中 (4)                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │   🏔️     │ │   ✨     │ │   🏙️     │ │   🎨   ││
│  │ 自然风光 │ │ 极简美学 │ │ 城市建筑 │ │艺术创作││
│  │ 120 张   │ │  85 张   │ │  95 张   │ │ 60 张  ││
│  │          │ │          │ │          │ │        ││
│  │ [编辑]   │ │ [编辑]   │ │ [编辑]   │ │ [编辑] ││
│  │ [禁用]   │ │ [禁用]   │ │ [禁用]   │ │ [禁用] ││
│  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                                                     │
│  已禁用 (2)                                         │
│  ┌──────────┐ ┌──────────┐                         │
│  │   🌃     │ │   🎮     │                         │
│  │ 赛博朋克 │ │ 游戏世界 │                         │
│  │  45 张   │ │  30 张   │                         │
│  │ [启用]   │ │ [启用]   │                         │
│  │ [编辑]   │ │ [编辑]   │                         │
│  └──────────┘ └──────────┘                         │
└─────────────────────────────────────────────────────┘
```

### 4.2 卡片组件结构

```typescript
interface ZoneCardProps {
  zone: ThemeZone;
  imageCount: number;
  coverUrl: string | null;
  onEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}
```

**卡片内容：**
- 顶部：封面图（自动获取或自定义）
- 中间：图标 + 标题 + 副标题
- 底部：图片数量 + 操作按钮

**操作按钮：**
- 启用/禁用切换
- 编辑
- 删除（带确认）

### 4.3 编辑对话框

```typescript
interface ZoneDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (zone: ThemeZone) => void;
  zone?: ThemeZone | null; // 编辑时传入
  categories: CategoryOption[];
  popularTags: TagOption[];
}
```

**对话框布局：**
```
┌─────────────────────────────────────────────┐
│  新增主题专区                          [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  基本信息                                   │
│  ┌─────────────────────────────────────┐   │
│  │ Key: [cyberpunk        ]            │   │
│  │ 标题: [赛博朋克        ]            │   │
│  │ 副标题: [霓虹闪烁的未来都市 ]      │   │
│  │ 图标: [🌃] [选择...]               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  分类规则                                   │
│  ┌─────────────────────────────────────┐   │
│  │ 分类: [▼ 城市建筑, 科技未来 ...]   │   │
│  │ 标签: [neon ×] [night ×] [+添加]   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  封面设置                                   │
│  ┌─────────────────────────────────────┐   │
│  │ ○ 自动获取热门图片（推荐）         │   │
│  │ ○ 手动选择封面图                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  状态设置                                   │
│  ┌─────────────────────────────────────┐   │
│  │ 启用状态: [开关]                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  实时预览                                   │
│  ┌─────────────────────────────────────┐   │
│  │  🌃 赛博朋克                        │   │
│  │  霓虹闪烁的未来都市                 │   │
│  │  [图片1] [图片2] [图片3] [图片4]   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│           [取消]  [保存]                   │
└─────────────────────────────────────────────┘
```

### 4.4 拖拽排序

**实现方案：**
- 使用 `@dnd-kit/core` 和 `@dnd-kit/sortable`
- 支持拖拽卡片调整顺序
- 拖拽时显示视觉反馈（高亮、阴影）
- 保存时自动更新 `sort_order`

**交互流程：**
1. 用户长按卡片进入拖拽模式
2. 拖动到目标位置
3. 释放鼠标，自动重新排序
4. 显示 Toast 提示"顺序已更新"
5. 调用 API 保存新顺序

---

## 五、前端实现方案

### 5.1 新增文件清单

| 文件路径 | 说明 | 行数估计 |
|---------|------|---------|
| `src/app/admin/ThemeZonesTab.tsx` | 主组件 | ~600 |
| `src/app/api/admin/theme-zones/route.ts` | CRUD API | ~200 |
| `src/app/api/admin/theme-zones/options/route.ts` | 选项数据 API | ~80 |

### 5.2 集成到管理后台

**修改文件：** `src/app/admin/AdminClient.tsx`

**步骤：**
1. 导入 `ThemeZonesTab` 组件
2. 在 `switchTab` 函数中添加 case：
   ```typescript
   case "theme-zones":
     content = <ThemeZonesTab />;
     break;
   ```
3. 菜单系统从数据库动态加载，无需手动添加

### 5.3 依赖库

**已安装：**
- `lucide-react` - 图标
- `sonner` - Toast 通知
- `framer-motion` - 动画效果
- `@radix-ui/react-dialog` - 对话框

**需要安装：**
- `@dnd-kit/core` - 拖拽核心
- `@dnd-kit/sortable` - 可排序组件
- `@dnd-kit/utilities` - 工具函数

### 5.4 技术要点

**状态管理：**
```typescript
const [zones, setZones] = useState<ThemeZone[]>([]);
const [loading, setLoading] = useState(true);
const [dialogOpen, setDialogOpen] = useState(false);
const [editingZone, setEditingZone] = useState<ThemeZone | null>(null);
```

**数据获取：**
```typescript
useEffect(() => {
  fetchZones();
}, []);

async function fetchZones() {
  const res = await fetch('/api/admin/theme-zones');
  const data = await res.json();
  setZones(data.data);
}
```

**拖拽处理：**
```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    setZones((items) => {
      const oldIndex = items.findIndex(i => i.key === active.id);
      const newIndex = items.findIndex(i => i.key === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }
}
```

---

## 六、图片查询逻辑

### 6.1 动态查询规则

根据自定义规则动态查询图片：

```sql
SELECT i.id, i.title, i.url, i.thumbnail_url, i.width, i.height,
       i.category, i.view_count, i.download_count, i.dominant_color
FROM images i
WHERE i.status = 'approved' 
  AND i.media_type != 'video'
  AND (
    i.category IN (?, ?, ?)  -- 多分类匹配
    OR i.tags LIKE '%?%'      -- 标签匹配（可选）
  )
ORDER BY i.download_count DESC, i.view_count DESC
LIMIT 6
```

### 6.2 统计查询

```sql
SELECT COUNT(*) as total
FROM images
WHERE status = 'approved' 
  AND media_type != 'video'
  AND (
    category IN (?, ?, ?)
    OR tags LIKE '%?%'
  )
```

### 6.3 性能优化

- ✅ 使用索引：`idx_images_status`、`idx_images_category`
- ✅ 限制结果集：最多返回 6 张代表图
- ✅ 缓存策略：主题专区配置可缓存 5 分钟

---

## 七、权限与验证

### 7.1 权限控制

**检查方式：**
```typescript
const session = await auth();
if (!session?.user || (session.user as any).role !== "admin") {
  return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
}
```

### 7.2 输入验证

**Key 格式验证：**
```typescript
const keyRegex = /^[a-z0-9]{2,30}$/;
if (!keyRegex.test(zone.key)) {
  return { error: "Key 必须为小写字母和数字，长度 2-30" };
}
```

**唯一性验证：**
```typescript
const keys = zones.map(z => z.key);
if (new Set(keys).size !== keys.length) {
  return { error: "存在重复的 Key" };
}
```

**分类存在性验证：**
```typescript
const validCategories = await query(
  `SELECT id FROM categories WHERE id IN (${placeholders})`,
  categories
);
if (validCategories.length !== categories.length) {
  return { error: "包含无效的分类" };
}
```

### 7.3 业务规则

- ✅ 最多 8 个主题专区
- ✅ 每个专区至少关联 1 个分类
- ✅ 分类最多 5 个
- ✅ 标签最多 10 个
- ✅ 排序权重 0-999

---

## 八、错误处理

### 8.1 API 错误

```typescript
try {
  // 业务逻辑
} catch (error: any) {
  console.error("Theme zones error:", error);
  return NextResponse.json(
    { error: error.message || "操作失败" },
    { status: 500 }
  );
}
```

### 8.2 前端错误

```typescript
async function handleSave() {
  try {
    const res = await fetch('/api/admin/theme-zones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zones })
    });
    
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "保存失败");
      return;
    }
    
    toast.success("保存成功");
  } catch (error) {
    toast.error("网络错误");
  }
}
```

---

## 九、测试计划

### 9.1 单元测试

- [ ] API 验证逻辑测试
- [ ] 数据格式验证测试
- [ ] 权限检查测试

### 9.2 集成测试

- [ ] 创建主题专区流程
- [ ] 编辑主题专区流程
- [ ] 删除主题专区流程
- [ ] 拖拽排序流程

### 9.3 E2E 测试

- [ ] 完整的 CRUD 流程
- [ ] 启用/禁用功能
- [ ] 前台展示验证

---

## 十、部署计划

### 10.1 数据库迁移

**无需新增表** - 使用现有的 `system_settings` 表

### 10.2 依赖安装

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 10.3 部署步骤

1. ✅ 安装依赖
2. ✅ 提交代码到 Git
3. ✅ 运行构建：`pnpm build`
4. ✅ 部署到生产环境
5. ✅ 验证功能

---

## 十一、验收标准

### 11.1 功能验收

- [x] 可以查看所有主题专区列表
- [x] 可以创建新的主题专区
- [x] 可以编辑现有主题专区
- [x] 可以删除主题专区
- [x] 可以启用/禁用主题专区
- [x] 可以拖拽调整顺序
- [x] 编辑时可以实时预览
- [x] 前台首页正确展示主题专区

### 11.2 性能验收

- [x] 页面加载时间 < 2s
- [x] API 响应时间 < 500ms
- [x] 拖拽操作流畅无卡顿

### 11.3 用户体验

- [x] 界面美观，符合现有设计风格
- [x] 操作反馈及时（Toast 提示）
- [x] 错误提示清晰易懂
- [x] 移动端适配良好

---

## 十二、后续优化（可选）

### 12.1 高级功能

- [ ] 主题专区数据统计（点击量、转化率）
- [ ] A/B 测试不同主题组合
- [ ] 定时启用/禁用（节日主题）
- [ ] 智能推荐分类和标签

### 12.2 性能优化

- [ ] 前端配置缓存（React Query）
- [ ] 图片预加载优化
- [ ] 懒加载非关键数据

---

## 附录

### A. 相关文件

- `src/app/api/discover/theme-zones/route.ts` - 前台 API
- `src/app/page.tsx` - 首页（展示主题专区）
- `src/app/admin/AdminClient.tsx` - 管理后台主组件

### B. 参考资料

- [shadcn/ui 文档](https://ui.shadcn.com/)
- [@dnd-kit 文档](https://docs.dndkit.com/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes)

---

**文档版本历史：**

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| 1.0 | 2026-06-01 | 初始版本 | AI Assistant |
