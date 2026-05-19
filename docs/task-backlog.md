# 任务清单 — blank-wallpaper-society

> 更新日期：2026-05-19
> 来源：bmad-brainstorming-2026-05-15.md + bmad-brainstorming-2026-05-17.md + bmad-brainstorming-2026-05-18.md 分析结果
> 状态：🚀 第四轮任务开发进行中（12项已完成，14项待开发，含第三轮2项遗留）

---

## 已完成任务（第一、二轮）

| 编号 | 任务 | 完成内容 |
|------|------|----------|
| P0-1 | 图片去重检测 | phash.ts 库 + 上传API集成（双路径）+ check-duplicate API + admin/duplicates API（并查集分组+批量删除）+ DB迁移(phash字段+索引) + 管理后台ImagesTab重复检测UI |
| P0-2 | 上传智能填充 | exif.ts 库 + tag-suggest.ts（文件名/分类/色彩标签+标题生成）+ smart-fill API + 上传API集成EXIF写入 + DB迁移(exif JSON字段) + UploadClient智能填充UI + Lightbox EXIF信息展示 |
| P1-1 | 设备预览Mockup | DeviceMockup.tsx（5种设备+拖拽+缩放）+ DeviceSelector.tsx + Lightbox设备预览模式集成 |
| P1-2 | 下载历史+分享 | 已有完整实现（ProfileClient下载历史Tab + Lightbox Web Share API） |
| P2-1 | 每日壁纸 | daily-wallpaper.ts（日期hash种子+内存缓存+零点刷新）+ daily-wallpaper API + personal API + RSS API + DailyWallpaperCard.tsx + 首页集成 |
| P2-2 | 通知系统完善 | notification.ts通知推送库 + 成就/审核/关注/收藏/评论5类自动推送 + DB迁移(notification_settings表+ENUM扩展) + 通知设置API + NotificationBell增强(achievement/favorite类型+设置入口) + 审核API集成通知 + 收藏API集成通知 + 关注API集成通知 + 评论API重构使用统一通知 |
| P2-3 | 用户等级与成就 | user-level.ts（10级体系+事务经验+成就检查+通知推送）+ DB迁移(user_levels/achievements/user_achievements表+12项初始成就) + level API + achievements API + LevelBadge.tsx + AchievementCard.tsx |
| P2-4 | 搜索增强(Meilisearch) | meilisearch.ts 客户端库 + 搜索API增强（优雅降级到MySQL LIKE）+ admin/search-sync API + 自动索引钩子（上传/审核/删除时） |
| P2-5 | 爬虫管理可视化 | SSE实时进度推送API(3秒轮询) + 定时任务管理API(CRUD+启用/禁用,system_settings存储) + 爬取结果预览+批量审核API(approve/reject/delete) + 搜索索引同步 |
| P3-1 | 图片变体预生成 | image-variants.ts（5种分辨率+3种缩略图）+ DB迁移(variants/thumbnails JSON字段) + admin/generate-variants API + 上传API集成异步变体生成 |
| P3-2 | API速率限制与计量 | API_TIERS套餐体系(free/pro/enterprise) + DB迁移(api_keys tier字段) + 用量统计增强(24h分布+错误率+热门端点) + admin/api-usage统计API(概览/小时趋势/Key详情) + 套餐管理PATCH API |
| P4-1 | 活动与挑战赛系统 | DB迁移(challenges/challenge_submissions/challenge_votes表) + 活动列表API + 活动详情API(含投稿列表+排行榜) + 投稿API(数量限制+重复检查) + 投票API(每日限制+自投检查) |
| P4-2 | Feed流增强 | 混合Feed(关注40%+推荐30%+热门30%) + 4种类型筛选(all/following/recommended/trending) + 用户收藏状态附加 + 基于收藏偏好的个性化推荐 + 热门排序trending_score |
| P4-3 | 嵌入式小组件 | DB迁移(embed_stats表) + 嵌入数据API(wallpaper/daily类型) + 点击统计API + 嵌入展示页面(/embed/wallpaper/[imageId]) + 每日壁纸小组件页面(/embed/daily) + 品牌水印+回链 |
| P5-1 | AI壁纸生成 | DB迁移(ai_generations表) + ai-generate.ts库(DALL-E+Stability AI双模型) + 8种风格(realistic/anime/abstract/oil_painting/watercolor/cyberpunk/nature/minimalist) + AI生成API + MinIO存储 + 超分辨率/风格迁移接口预留 |
| P5-2 | 创作者收益分成 | DB迁移(paid_wallpapers/tips/memberships/earnings/orders 5张表) + earnings.ts库(付费壁纸设置+打赏+会员订阅+收益概览+FIFO提现) + 收益API(5种action) + 平台15%抽成 + 会员月/年订阅 |

---

## 未完成任务（第三轮新增）

### 🔴 P0 — 必须立即修复（安全/数据风险）

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P0-3 | 数据库凭据迁移到环境变量 | ⏸ 暂缓 | db.ts 中数据库密码明文硬编码，用户要求暂缓 | 小 |
| P0-4 | MinIO/Redis 凭据迁移到环境变量 | ⏸ 暂缓 | minio.ts/redis.ts 凭据硬编码，用户要求暂缓 | 小 |
| P0-5 | 输入校验与 XSS 防护 | ✅ 已完成 | sanitize-html 库 + 评论/昵称/搜索/注册/上传全链路 XSS 过滤 | 中 |
| P0-6 | 数据库事务覆盖关键操作 | ✅ 已完成 | db-tx.ts 事务库 + 注册(并发防重复) + 注销(13步原子化) + 打赏/订阅 | 中 |

### 🔴 P1 — 高优先级

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P1-3 | NSFW 检测集成到上传流程 | ✅ 已完成 | 已在上传 API 中集成 processNSFWDetection | 小-中 |
| P1-4 | 错误监控（Sentry） | ✅ 已完成 | @sentry/nextjs 客户端+服务端配置，生产环境启用 | 中 |
| P1-5 | 数据库连接池调优 | ✅ 已完成 | connectionLimit 3→15，maxIdle 1→5，idleTimeout 30s→60s，支持环境变量 | 小 |
| P1-6 | 批量上传 | ✅ 已完成 | /api/upload/batch 端点，支持最多5文件同时上传 | 中 |
| P1-7 | 健康检查端点 | ✅ 已完成 | /api/health 端点，数据库连通性检查 + 延迟 + uptime | 小 |

### 🟡 P2 — 中优先级

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P2-6 | 限流迁移到 Redis | ✅ 已完成 | rate-limit.ts 迁移到 Redis + 内存降级，支持多实例 | 中 |
| P2-7 | Docker 容器化 | 🔴 待开发 | 无 Dockerfile/docker-compose.yml | 中 |
| P2-8 | 结构化日志体系 | ✅ 已完成 | pino 日志库 + 结构化 JSON 输出 + 子日志器支持 | 中 |
| P2-9 | API 请求日志中间件 | ✅ 已完成 | middleware.ts 添加 JSON 结构化请求日志 | 小-中 |
| P2-10 | 测试覆盖（核心路径） | 🔴 待开发 | 仅有 1 个测试文件，核心业务零覆盖 | 大 |
| P2-11 | 数据库索引优化 | ✅ 已完成 | 12个新索引覆盖 images/users/comments/download_logs/posts | 小 |
| P2-12 | 用户存储配额 | ✅ 已完成 | storage-quota.ts + 上传API集成配额检查 | 小-中 |

### 🟢 P3 — 低-中优先级

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P3-3 | 水印功能完善 | ✅ 已完成 | watermark.ts 重构为配置化（位置/颜色/透明度/平铺）+ 系统设置读取 + 下载API集成 | 中 |
| P3-4 | 用户数据导出 | ✅ 已完成 | /api/user/export 端点，JSON格式导出15类用户数据，GDPR合规 | 中 |
| P3-5 | 暗黑模式全面验证 | ✅ 已完成 | 已验证：next-themes + CSS变量体系完整，.dark类下所有变量已定义，shadcn/ui组件自动适配 | 中 |
| P3-6 | CSP 安全策略 | ✅ 已完成 | next.config.ts 添加 Content-Security-Policy + X-Content-Type-Options + X-Frame-Options + Referrer-Policy + Permissions-Policy | 小-中 |
| P3-7 | API Key 安全增强 | ✅ 已完成 | 确认Key仅存hash + 默认90天自动过期(expires_at) + 前缀显示遮蔽 + 过期自动禁用 | 小-中 |
| P3-8 | 优雅关闭机制 | ✅ 已完成 | instrumentation.ts 注册 SIGTERM/SIGINT 信号处理，关闭Redis连接+数据库连接池 | 小 |
| P3-9 | 视频壁纸上传支持 | ✅ 已完成 | 上传API支持MP4/WebM，视频50MB限制，ffmpeg缩略图提取，跳过sharp/pHash/EXIF/NSFW | 中-大 |

### 🔵 P4 — 长期演进

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P4-4 | API 版本化 | ✅ 已完成 | next.config.ts rewrites: /api/v1/* → /api/* | 小 |
| P4-5 | Webhook 机制 | ✅ 已完成 | webhook.ts 事件投递库 + webhook_subscriptions/delivery_logs 表 + /api/webhooks CRUD + HMAC-SHA256签名 + 重试机制 + 投递日志 | 中-大 |
| P4-6 | API Schema 验证（Zod） | ✅ 已完成 | api-schemas.ts Zod验证库 + 全API Schema定义 + validateRequestBody工具函数 + bots API已集成 | 中-大 |
| P4-7 | 用户行为分析 | ✅ 已完成 | analytics.ts + Umami/PostHog双服务支持 + 管理后台分析配置分组 + /api/analytics-config客户端配置 + 服务端事件追踪 | 中 |
| P4-8 | 飞书/QQ机器人通知 | ✅ 已完成 | bot-notification.ts（6种机器人）+ bot_configs表 + /api/admin/bots CRUD + /api/admin/bots/test测试 + BotsTab管理UI + pushNotification集成 + 事件订阅过滤 | 中 |

---

## 未完成任务（第四轮新增）

### 🔴 P0 — 必须立即修复/实现（影响核心留存和变现）

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P0-7 | 图片SSR详情页 `/images/[id]` | ✅ 已完成 | SSR页面+JSON-LD+OG元数据+canonical URL+评论+相似推荐+社交分享 | 中 |
| P0-8 | 新手引导闭环 | ✅ 已完成 | 渐进式引导+6项新手任务链+空状态引导组件+任务预览+经验值奖励 | 中 |
| P0-9 | 下载后互动引导 | ✅ 已完成 | DownloadSuccessGuide组件+收藏/分享/关注/相似推荐引导+设壁纸教程 | 小-中 |

### 🔴 P1 — 高优先级

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P1-8 | SEO深度优化 | ✅ 已完成 | JSON-LD(ImageObject)+OG图+ALT文本+canonical URL+动态元数据（图片详情页集成） | 中 |
| P1-9 | 付费壁纸购买前端+支付集成 | ✅ 已完成 | PaymentDialog收款码支付弹窗+订单API+下载API付费拦截+管理后台订单确认+会员订阅支付 | 大 |
| P1-10 | AI生成流程闭环 | ✅ 已完成 | AI配额检查(3/30/无限)+source_type标记+自动进审核队列+image_id关联 | 中 |
| P1-11 | 搜索体验完善 | ✅ 已完成 | 搜索分面筛选API(/api/search/facets:分类/颜色/分辨率聚合)+零结果推荐(随机8张)+前端推荐网格 | 中 |

### 🟡 P2 — 中优先级

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P2-13 | 会员体系前端+定价页面 | ✅ 已完成 | `/pricing`页面+免费/Pro/企业三档+月/年付切换+FAQ+Badge | 中 |
| P2-14 | 创作者认证与品牌体系 | 🔴 待开发 | 认证流程+专属特权+主页自定义 | 中 |
| P2-15 | 评论系统互动增强 | ✅ 已完成 | 评论点赞API+前端点赞UI(ThumbsUp按钮)+排序切换(最新/最热)+嵌套回复+like_count字段 | 中 |
| P2-16 | 社交分享深度集成 | ✅ 已完成 | SocialShare组件(微信/微博/QQ/Twitter/X+复制链接+Web Share API)+UTM追踪(utm_source/medium/campaign)+图片详情页集成 | 中 |
| P2-17 | AI视觉标注与分类 | 🔴 待开发 | 视觉理解模型自动标签+质量评分 | 中-大 |
| P2-18 | 细粒度API速率限制 | ✅ 已完成 | ENDPOINT_RATE_LIMITS配置+按端点差异化限流(下载/搜索/AI/上传/评论)+会员倍数+Redis+内存降级 | 小-中 |
| P2-19 | 用户反馈机制 | ✅ 已完成 | feedback表+浮动反馈按钮(分类选择)+反馈API+管理后台查询+状态流转 | 小-中 |

### 🟢 P3 — 低-中优先级

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P3-10 | 用户主页定制 | 🔴 待开发 | Banner/简介/社交链接/精选合集置顶 | 中 |
| P3-11 | 内容发现机制 | 🔴 待开发 | 编辑精选轮播/主题专区/新人专区 | 中 |
| P3-12 | 邮件营销体系 | 🔴 待开发 | 每周精选邮件+活动通知+退订管理 | 中 |
| P3-13 | 广告/赞助位管理 | 🔴 待开发 | 广告位模板+会员免广告+统计 | 中-大 |
| P3-14 | AI推荐引擎 | 🔴 待开发 | 协同过滤+特征向量+实时推荐 | 大 |
| P3-15 | AI聊天助手面向用户 | 🔴 待开发 | 对话式搜索+壁纸顾问 | 中 |
| P3-16 | 国际化(i18n) | 🔴 待开发 | next-intl+中英文支持+本地化 | 大 |

### 🔵 P4 — 长期演进

| 编号 | 任务 | 状态 | 说明 | 工作量 |
|------|------|------|------|--------|
| P4-9 | 私信系统 | 🔴 待开发 | WebSocket实时私信+对话管理 | 大 |
| P4-10 | 桌面客户端 | 🔴 待开发 | Electron自动换壁纸+系统托盘 | 大 |
| P4-11 | 壁纸引擎集成 | 🔴 待开发 | Wallpaper Engine创意工坊 | 中-大 |
| P4-12 | B2B品牌壁纸定制 | 🔴 待开发 | 企业定制+批量管理+白标 | 大 |
| P4-13 | 创作者经济/NFT | 🔴 待开发 | NFT铸造+DAO+创作者基金 | 大 |

---

## 技术债务

| 项目 | 说明 |
|------|------|
| CrawlTab CrawlResult 类型 | `image_url` 字段已添加但爬虫脚本可能未使用 |
| DB 字段缺失 | `favorite_count` 列在 daily-wallpaper 查询中使用但 images 表可能无此列 |
| 图片计数冗余 | `download_count`/`view_count` 应检查是否有触发更新机制 |
| Meilisearch 依赖 | 已安装但需要部署 Meilisearch 服务才能使用搜索增强功能 |
| AI 生成支付接口 | DALL-E/Stability AI 的 OPENAI_API_KEY/STABILITY_API_KEY 需配置 |
| 收益支付接口 | 微信/支付宝支付回调需接入真实支付SDK |
| 超分辨率/风格迁移 | 需部署 Real-ESRGAN 和风格迁移模型 |
| 凭据硬编码 | db.ts 已支持环境变量（保留硬编码为默认值），minio.ts/redis.ts 仍需处理（用户暂缓） |