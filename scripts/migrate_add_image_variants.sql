-- 图片变体预生成：添加 variants 和 thumbnails JSON 字段
-- 变体信息存储为 JSON，避免额外表

-- variants 格式: {"mobile": {"url": "...", "width": 1080, "height": 1920, "size": 123456}, "desktop": {...}, "original": {...}}
ALTER TABLE images ADD COLUMN variants JSON DEFAULT NULL COMMENT '预生成的变体信息';

-- thumbnails 格式: {"thumb_sm": {"url": "...", "width": 200, "height": 200, "size": 12345}, "thumb_md": {...}, "thumb_lg": {...}}
ALTER TABLE images ADD COLUMN thumbnails JSON DEFAULT NULL COMMENT '预生成的缩略图信息';