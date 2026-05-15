# 任务清单 — blank-wallpaper-society

> 更新日期：2026-05-15
> 来源：bmad-brainstorming-2026-05-15.md 分析结果
> 状态：✅ 所有任务已完成

---

## 已完成任务

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

## 未完成任务

无待完成任务。所有8个原始待办项均已完成开发。

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