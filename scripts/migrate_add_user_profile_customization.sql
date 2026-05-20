-- 用户主页定制功能迁移
-- 新增 banner、bio、featured_collections 字段

ALTER TABLE users ADD COLUMN banner VARCHAR(500) DEFAULT NULL COMMENT '主页Banner图URL';
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL COMMENT '个人简介';
ALTER TABLE users ADD COLUMN featured_collections JSON DEFAULT NULL COMMENT '精选合集ID列表(置顶)';