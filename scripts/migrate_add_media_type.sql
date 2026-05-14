-- 为images表增加动态壁纸支持字段
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_add_media_type.sql

-- 媒体类型字段：image(静态图片) / video(动态壁纸)
ALTER TABLE images ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'image' COMMENT '媒体类型: image/video(动态壁纸)';

-- 动态壁纸视频URL（仅 media_type=video 时有值）
ALTER TABLE images ADD COLUMN IF NOT EXISTS video_url VARCHAR(1000) DEFAULT NULL COMMENT '动态壁纸视频URL';

-- 视频封面图URL（用于动态壁纸的静态预览图）
ALTER TABLE images ADD COLUMN IF NOT EXISTS poster_url VARCHAR(1000) DEFAULT NULL COMMENT '视频封面图URL';

-- 索引
CREATE INDEX IF NOT EXISTS idx_media_type ON images(media_type);