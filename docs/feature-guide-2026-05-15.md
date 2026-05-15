# 新功能使用说明文档

> 更新日期：2026-05-15
> 版本：v2.0

本文档描述了 2026-05-15 新增的 10 项功能的使用方法。

---

## 目录

1. [下载历史](#1-下载历史)
2. [修改密码](#2-修改密码)
3. [SEO 优化](#3-seo-优化)
4. [密码重置](#4-密码重置)
5. [相似图片推荐](#5-相似图片推荐)
6. [搜索自动补全](#6-搜索自动补全)
7. [社交登录](#7-社交登录)
8. [标签管理系统](#8-标签管理系统)
9. [关注系统](#9-关注系统)
10. [水印保护](#10-水印保护)

---

## 1. 下载历史

### 功能说明

用户可以在个人主页查看自己所有的下载记录，包括下载的壁纸、下载时间和所选分辨率。

### 使用方式

1. 登录后访问 **个人主页**（`/profile`）
2. 在 Tabs 栏中点击 **「下载历史」** 标签
3. 以瀑布流网格展示已下载的壁纸，包含：
   - 壁纸缩略图
   - 壁纸标题和作者
   - 下载时选择的分辨率角标（如"原图"、"desktop"等）
4. 超过 12 条记录时自动显示分页控件

### API 接口

```
GET /api/user/downloads?page=1&limit=12
```

**响应示例：**

```json
{
  "data": [
    {
      "id": 1,
      "image_id": 42,
      "title": "山间日落",
      "thumbnail_url": "https://...",
      "author": "摄影师A",
      "resolution": "desktop",
      "downloaded_at": "2026-05-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 35,
    "totalPages": 3
  }
}
```

---

## 2. 修改密码

### 功能说明

用户可以在个人主页直接修改登录密码，无需跳转其他页面。

### 使用方式

1. 登录后访问 **个人主页**（`/profile`）
2. 在统计概览下方的 **「修改密码」** 区域
3. 填写：
   - **当前密码** — 验证身份
   - **新密码** — 至少 6 个字符
   - **确认新密码** — 必须与新密码一致
4. 点击 **「修改密码」** 按钮
5. 修改成功后，下次登录需使用新密码

### API 接口

```
PATCH /api/auth/profile
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

**安全说明：**
- 当前密码会通过 SHA-256 哈希后与数据库比对
- 新密码同样使用 SHA-256 哈希存储
- 密码验证失败会返回 400 错误

---

## 3. SEO 优化

### 功能说明

全站 SEO 优化，包括元标签、Open Graph、结构化数据、Sitemap 和 robots.txt，提升搜索引擎收录效果。

### 配置项

| 配置 | 位置 | 说明 |
|------|------|------|
| 网站元信息 | `src/app/layout.tsx` | title template、description、keywords、OpenGraph、Twitter Card |
| Sitemap | `src/app/sitemap.ts` | 动态生成，包含静态页面 + 已通过审核的图片（最多500）+ 公开合集（最多100） |
| Robots | `src/app/robots.ts` | 允许 `/`，屏蔽 `/admin/`、`/api/`、`/profile/`、`/editor/` |
| JSON-LD | `src/app/page.tsx` | WebSite 类型 + SearchAction，支持搜索引擎站内搜索 |
| 子页面元信息 | 各 `layout.tsx` | rankings、collections、upload 页面独立 SEO 描述 |

### 环境变量

```env
# 站点域名，用于生成 sitemap 和 Open Graph URL
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 验证方式

- 访问 `/sitemap.xml` 查看 sitemap
- 访问 `/robots.txt` 查看 robots 规则
- 查看页面源代码，检查 `<head>` 中的 meta 标签和 JSON-LD

---

## 4. 密码重置

### 功能说明

忘记密码的用户可以通过邮箱重置密码。系统生成一次性令牌，有效期 1 小时。

### 使用方式

#### 用户流程

1. 在登录页点击 **「忘记密码？」** 链接
2. 进入 `/forgot-password` 页面
3. 输入注册邮箱，点击 **「发送重置链接」**
4. 系统提示"重置链接已发送"（无论邮箱是否存在都显示相同提示，防止邮箱枚举）
5. 在邮箱中点击重置链接，进入 `/reset-password?token=xxx`
6. 输入新密码（至少 6 个字符）并确认
7. 重置成功后跳转登录页

#### 管理员配置

当前版本暂未集成邮件发送服务。开发环境中，重置令牌会输出到服务器控制台日志：

```
[DEV] 密码重置链接: http://localhost:3000/reset-password?token=abc123...
```

生产环境需要：
1. 配置邮件发送服务（如 Resend、SendGrid、SMTP）
2. 修改 `src/app/api/auth/forgot-password/route.ts` 中的 TODO 部分，发送包含重置链接的邮件
3. 移除开发模式的 `dev_token` 返回

### API 接口

```
# 请求重置
POST /api/auth/forgot-password
{ "email": "user@example.com" }

# 执行重置
POST /api/auth/reset-password
{ "token": "abc123...", "newPassword": "new_pass" }
```

### 数据库

`password_reset_tokens` 表存储重置令牌，字段包括：
- `token` — 唯一令牌（64 位十六进制）
- `expires_at` — 过期时间（1 小时）
- `used_at` — 使用时间（使用后标记，防止重复使用）

---

## 5. 相似图片推荐

### 功能说明

在图片详情（Lightbox）中查看相似壁纸，基于分类和主色调智能推荐。

### 使用方式

1. 在首页瀑布流中点击任意壁纸，打开 Lightbox
2. 点击底部操作栏的 **「相似」** 按钮（Sparkles 图标）
3. 右侧滑出 **相似壁纸面板**，展示推荐结果
4. 每张推荐图片带有匹配类型角标：
   - **同类**（蓝色）— 同分类
   - **同色**（紫色）— 同主色调
5. 点击推荐图片可跳转查看

### 推荐算法

1. **优先同分类**：获取与当前图片相同分类的壁纸（最多 8 张）
2. **补充同色调**：获取主色调相同但分类不同的壁纸（最多 4 张）
3. **随机填充**：以上不足 6 张时，补充随机推荐

### API 接口

```
GET /api/images/{id}/similar
```

---

## 6. 搜索自动补全

### 功能说明

在导航栏搜索框输入关键词时，实时显示搜索建议下拉列表。

### 使用方式

1. 在导航栏搜索框中输入 1 个以上字符
2. 等待约 300ms（防抖），自动显示建议下拉
3. 建议按类型分组显示：
   - 🖼 **标题** — 匹配壁纸标题
   - 🏷 **分类** — 匹配分类名称
   - # **标签** — 匹配图片标签
4. 点击建议项自动填充并搜索

### 技术细节

- 防抖延迟：300ms
- 最多显示 8 条建议
- 搜索框失焦后 200ms 自动关闭下拉（允许点击建议项）

### API 接口

```
GET /api/search/suggest?q=关键词
```

**响应示例：**

```json
{
  "suggestions": [
    { "type": "title", "text": "山间日落" },
    { "type": "category", "text": "nature" },
    { "type": "tag", "text": "wallpaper" }
  ]
}
```

---

## 7. 社交登录

### 功能说明

支持 Google 和 GitHub 第三方登录，降低注册门槛。

### 使用方式

1. 在登录页（`/login`）看到 **「或使用第三方账号登录」** 分隔线
2. 点击 **Google** 或 **GitHub** 按钮
3. 跳转到对应 OAuth 授权页面
4. 授权后自动完成：
   - 新用户：自动注册账号（随机密码）+ 关联 OAuth
   - 老用户：直接登录（通过邮箱匹配关联）

### 管理员配置

需要在环境变量中配置 OAuth 凭据：

```env
# Google OAuth（从 Google Cloud Console 获取）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth（从 GitHub Developer Settings 获取）
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Auth Secret（用于 JWT 签名）
AUTH_SECRET=your-random-secret-key
```

#### Google OAuth 配置步骤

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → APIs & Services → Credentials
3. 创建 OAuth 2.0 Client ID
4. 授权重定向 URI：`https://your-domain.com/api/auth/callback/google`

#### GitHub OAuth 配置步骤

1. 访问 [GitHub Developer Settings](https://github.com/settings/developers)
2. New OAuth App
3. Authorization callback URL：`https://your-domain.com/api/auth/callback/github`

### 安全说明

- 启用了 `allowDangerousEmailAccountLinking`，允许相同邮箱的 OAuth 账号自动关联
- OAuth 账号信息存储在 `oauth_accounts` 表
- 自动注册的用户密码为随机生成的 64 位十六进制字符串

---

## 8. 标签管理系统

### 功能说明

从现有图片的 tags 数据中动态提取标签，生成标签云页面，支持按标签浏览壁纸。

### 使用方式

#### 标签云页面

1. 在导航栏点击 **「标签」** 链接，进入 `/tags`
2. 页面顶部展示 **热门标签**（前 10 名，品牌色胶囊按钮）
3. 下方展示 **标签云**，标签大小按使用频率分为 5 级
4. 每个标签显示使用次数
5. 点击任意标签，跳转首页搜索该标签

#### 标签来源

标签直接从 `images` 表的 `tags` 字段提取：
- 支持 JSON 数组格式：`["nature","wallpaper","hd"]`
- 支持逗号分隔格式：`nature,wallpaper,hd`
- 自动去重和大小写归一化

### API 接口

```
# 标签云（含大小等级）
GET /api/tags?type=cloud

# 热门标签（前 30）
GET /api/tags?type=popular

# 全部标签（从 tags 表）
GET /api/tags?type=all
```

**响应示例：**

```json
{
  "data": [
    { "name": "wallpaper", "slug": "wallpaper", "count": 150, "size": 5 },
    { "name": "nature", "slug": "nature", "count": 80, "size": 3 },
    { "name": "hd", "slug": "hd", "count": 45, "size": 1 }
  ]
}
```

### 数据库

- `tags` 表 — 存储标签元数据（预留，当前从 images 表动态提取）
- `image_tags` 表 — 图片-标签关联（预留，未来迁移用）

---

## 9. 关注系统

### 功能说明

用户可以关注创作者，形成创作者-粉丝关系。Feed 流展示关注用户的最新作品。

### 使用方式

#### 关注/取关

1. 访问任意 **创作者主页**（`/creator/{id}`）
2. 在创作者名字旁点击 **「关注」** 按钮
3. 关注后按钮变为 **「已关注」**（UserCheck 图标）
4. 再次点击可取消关注

#### 创作者主页增强

- 统计区域新增 **粉丝数** 展示
- 自己的主页不显示关注按钮

### API 接口

```
# 关注/取关（切换）
POST /api/users/{id}/follow

# 获取关注状态和数量
GET /api/users/{id}/follow

# 获取关注用户的最新作品（Feed 流）
GET /api/feed?page=1&limit=20
```

**响应示例（关注状态）：**

```json
{
  "followersCount": 128,
  "followingCount": 35,
  "isFollowing": true
}
```

**响应示例（关注操作）：**

```json
{
  "following": true,
  "message": "已关注"
}
```

### 数据库

`user_follows` 表：
- `follower_id` — 关注者
- `following_id` — 被关注者
- 联合唯一约束防止重复关注

---

## 10. 水印保护

### 功能说明

上传图片时自动叠加文字水印，保护创作者权益。水印可通过管理后台开关控制。

### 使用方式

#### 管理员配置

1. 登录管理员账号，进入 **管理后台**（`/admin`）
2. 切换到 **「设置」** Tab
3. 在 **「水印设置」** 区域：
   - **启用水印** — 开关切换
   - **水印文字** — 自定义水印内容（默认 "Blank Wallpaper"）
4. 点击保存

#### 水印效果

水印由两部分组成：
1. **右下角主水印** — 明确的版权标识
2. **居中斜置半透明水印** — 30° 旋转，低透明度（15%），防盗用

水印大小根据图片分辨率自适应（1920px 宽度约 64px 字号）。

### 技术细节

- 使用 Sharp 库的 SVG composite 实现水印叠加
- 水印在上传流程中处理，仅对原图生效
- 缩略图不添加水印
- 水印处理失败时自动回退到原图，不影响上传

### API 接口

水印通过上传接口自动处理，无需单独调用。

**相关系统设置：**

| 设置键 | 说明 | 默认值 |
|--------|------|--------|
| `watermark_enabled` | 是否启用水印 | `true` |
| `watermark_text` | 水印文字 | `Blank Wallpaper` |

---

## 新增数据库表汇总

| 表名 | 用途 |
|------|------|
| `password_reset_tokens` | 密码重置令牌（token, expires_at, used_at） |
| `oauth_accounts` | OAuth 账号关联（provider, provider_account_id） |
| `tags` | 标签元数据（name, slug, image_count） |
| `image_tags` | 图片-标签关联（image_id, tag_id） |
| `user_follows` | 用户关注关系（follower_id, following_id） |

---

## 新增文件汇总

### API 路由

| 文件路径 | 功能 |
|----------|------|
| `src/app/api/user/downloads/route.ts` | 下载历史查询 |
| `src/app/api/auth/forgot-password/route.ts` | 密码重置请求 |
| `src/app/api/auth/reset-password/route.ts` | 执行密码重置 |
| `src/app/api/images/[id]/similar/route.ts` | 相似图片推荐 |
| `src/app/api/search/suggest/route.ts` | 搜索建议 |
| `src/app/api/users/[id]/follow/route.ts` | 关注/取关 |
| `src/app/api/feed/route.ts` | Feed 流 |
| `src/app/api/tags/route.ts` | 标签云/列表 |

### 页面

| 文件路径 | 功能 |
|----------|------|
| `src/app/forgot-password/page.tsx` | 忘记密码页 |
| `src/app/reset-password/page.tsx` | 重置密码页 |
| `src/app/tags/page.tsx` | 标签云页 |

### 组件

| 文件路径 | 功能 |
|----------|------|
| `src/components/SimilarImages.tsx` | 相似图片面板 |

### 工具库

| 文件路径 | 功能 |
|----------|------|
| `src/lib/watermark.ts` | 水印叠加工具 |

### 配置文件

| 文件路径 | 功能 |
|----------|------|
| `src/app/sitemap.ts` | 动态 sitemap |
| `src/app/robots.ts` | robots.txt |
| `src/app/rankings/layout.tsx` | 排行榜 SEO |
| `src/app/collections/layout.tsx` | 合集 SEO |
| `src/app/upload/layout.tsx` | 上传 SEO |