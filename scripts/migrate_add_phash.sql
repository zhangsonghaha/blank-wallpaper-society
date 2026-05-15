-- 添加 phash 字段用于图片去重检测
ALTER TABLE images ADD COLUMN phash VARCHAR(16) DEFAULT NULL;
CREATE INDEX idx_images_phash ON images(phash);