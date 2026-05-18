-- 添加 source_type 字段到 images 表
-- 用于标记图片来源：upload / ai_generated / crawled

ALTER TABLE images 
ADD COLUMN source_type VARCHAR(20) DEFAULT 'upload' COMMENT '图片来源: upload/ai_generated/crawled' AFTER status;

-- 添加 image_id 字段到 ai_generations 表
-- 用于关联AI生成图片到 images 表
ALTER TABLE ai_generations
ADD COLUMN image_id INT DEFAULT NULL COMMENT '关联的 images 表 ID' AFTER result_url;

-- 添加索引
CREATE INDEX idx_images_source_type ON images(source_type);
CREATE INDEX idx_ai_generations_image_id ON ai_generations(image_id);