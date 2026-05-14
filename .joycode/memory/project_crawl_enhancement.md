---
name: crawl-category-tags-enhancement
description: 爬虫分类/标签增强和爬取历史记录功能
type: project
---

2026-05-14: 爬取系统增强 - 分类/标签自动提取 + 手动回退 + 爬取历史表 + CDN后缀支持 + 动态壁纸

**Why:** 爬取的图片大部分标记为"未分类"且无标签，CDN处理后缀(.jpg-pcthumbs/.jpeg_webp)的图片无法识别，缺少爬取历史记录，不支持动态壁纸
**How to apply:** 
- Python 爬虫新增3种元数据提取方式（父元素、页面级meta、面包屑导航）
- 新增 `--category` 和 `--tags` CLI参数作为自动提取失败时的回退
- 新建 `crawl_logs` 表记录每次爬取任务（源/分类/标签/成功数/失败数/耗时）
- 修复图片URL识别：使用正则匹配 `.jpg-pcthumbs`、`.jpeg_webp` 等CDN处理参数后缀
- 修复 `_url_to_filename`：从非标准后缀中正确提取真实扩展名
- 新增 `_extract_video_tags` 方法提取 `<video>` 标签中的动态壁纸
- 新增 `_detect_media_type` 方法区分 image/video
- images 表新增 `media_type`/`video_url`/`poster_url` 三个字段
- API route 支持视频文件上传（存到 videos/ 目录）、视频封面图处理
- 前端 PinCard：hover时自动播放动态壁纸，LIVE标签，Play图标
- 前端 Lightbox：动态壁纸自动播放+controls控制
- 前端 CrawlTab：爬取结果和任务日志中标识动态壁纸
- MasonryGrid/CrawlTab 的数据类型增加 media_type/video_url/poster_url