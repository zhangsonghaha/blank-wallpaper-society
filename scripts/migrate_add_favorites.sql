-- =====================================================
-- 迁移脚本: 创建收藏表 favorites
-- 日期: 2026-05-14
-- 描述: 
--   创建 favorites 表，用于用户收藏图片功能
--   唯一约束防止重复收藏，外键关联 users 和 images 表
-- =====================================================

-- 创建收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '收藏用户ID',
  image_id INT NOT NULL COMMENT '收藏图片ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  UNIQUE KEY uk_user_image (user_id, image_id) COMMENT '防止重复收藏',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户收藏图片表';

-- 索引
CREATE INDEX idx_favorites_user_id ON favorites(user_id) COMMENT '按用户查询收藏';
CREATE INDEX idx_favorites_image_id ON favorites(image_id) COMMENT '按图片查询收藏';
CREATE INDEX idx_favorites_created_at ON favorites(created_at) COMMENT '按时间排序收藏';