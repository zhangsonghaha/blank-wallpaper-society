-- NSFW 自动检测功能迁移
-- 添加 images 表的 nsfw 相关字段和系统设置

-- 1. images 表添加 nsfw_score 和 nsfw_flagged 字段
ALTER TABLE images
  ADD COLUMN nsfw_score JSON DEFAULT NULL COMMENT 'NSFW检测各分类概率: {"Drawing":0.01,"Hentai":0.02,"Neutral":0.90,"Porn":0.05,"Sexy":0.02}',
  ADD COLUMN nsfw_flagged TINYINT(1) DEFAULT 0 COMMENT '是否被NSFW检测标记为可疑';

-- 2. 添加 nsfw_flagged 索引（便于审核列表筛选）
ALTER TABLE images ADD INDEX idx_nsfw_flagged (nsfw_flagged);

-- 3. 系统设置中添加 NSFW 检测相关配置
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('nsfw_enabled', 'false', '启用NSFW自动检测'),
  ('nsfw_threshold', '0.7', 'NSFW检测阈值(0-1)，Porn/Hentai概率超过此值标记为可疑'),
  ('nsfw_action', 'flag', 'NSFW检测行为: flag=仅标记, pending=标记+待审核, reject=自动拒绝');