-- 评论系统迁移脚本
-- 创建评论表，支持图片评论和回复功能

CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_id INT NOT NULL COMMENT '图片ID',
  user_id INT NOT NULL COMMENT '评论用户ID',
  content TEXT NOT NULL COMMENT '评论内容',
  parent_id INT DEFAULT NULL COMMENT '父评论ID(用于回复)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_image (image_id),
  INDEX idx_user (user_id),
  INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;