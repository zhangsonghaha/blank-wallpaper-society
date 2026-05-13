-- 为images表添加颜色字段
-- 主色调字段，存储HEX格式颜色值，如 "#E60023"
ALTER TABLE images ADD COLUMN IF NOT EXISTS dominant_color VARCHAR(7) DEFAULT NULL COMMENT '主色调HEX值';

-- 调色板字段，JSON格式存储最多5个颜色，如 '["#E60023","#FFFFFF","#000000","#336699","#CC9900"]'
ALTER TABLE images ADD COLUMN IF NOT EXISTS color_palette VARCHAR(200) DEFAULT NULL COMMENT '调色板JSON数组';

-- 为主色调字段创建索引以优化颜色搜索查询
CREATE INDEX IF NOT EXISTS idx_dominant_color ON images(dominant_color);