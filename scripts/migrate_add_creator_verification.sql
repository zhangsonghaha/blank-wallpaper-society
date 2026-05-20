-- 创作者认证与品牌体系迁移脚本
-- 添加创作者认证相关字段到 users 表

ALTER TABLE users
  ADD COLUMN `is_verified` TINYINT(1) DEFAULT 0 COMMENT '是否认证创作者',
  ADD COLUMN `verified_at` DATETIME NULL COMMENT '认证时间',
  ADD COLUMN `brand_name` VARCHAR(100) NULL COMMENT '品牌名',
  ADD COLUMN `brand_description` TEXT NULL COMMENT '品牌描述',
  ADD COLUMN `brand_website` VARCHAR(500) NULL COMMENT '品牌官网',
  ADD COLUMN `social_links` JSON NULL COMMENT '社交链接（微博/推特/B站/小红书等）',
  ADD COLUMN `verification_status` ENUM('none','pending','approved','rejected') DEFAULT 'none' COMMENT '认证状态',
  ADD COLUMN `verification_applied_at` DATETIME NULL COMMENT '认证申请时间',
  ADD COLUMN `verification_rejected_reason` VARCHAR(500) NULL COMMENT '认证拒绝原因',
  ADD COLUMN `verification_real_name` VARCHAR(100) NULL COMMENT '申请人真实姓名',
  ADD COLUMN `verification_id_type` VARCHAR(50) NULL COMMENT '身份证明类型',
  ADD COLUMN `verification_id_number` VARCHAR(100) NULL COMMENT '身份证明编号',
  ADD COLUMN `verification_portfolio_url` VARCHAR(500) NULL COMMENT '作品集链接';

-- 添加索引
CREATE INDEX idx_users_verification_status ON users(verification_status);
CREATE INDEX idx_users_is_verified ON users(is_verified);