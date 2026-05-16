-- 动态发布功能数据库迁移脚本
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_add_posts.sql

-- 动态帖子表
CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '发布用户ID',
  content TEXT NOT NULL COMMENT '帖子内容（支持文字、链接解析）',
  visibility ENUM('public', 'followers', 'private') DEFAULT 'public' COMMENT '可见范围',
  likes_count INT DEFAULT 0 COMMENT '点赞数',
  comments_count INT DEFAULT 0 COMMENT '评论数',
  attachments_count INT DEFAULT 0 COMMENT '附件数量（图片/视频）',
  is_pinned TINYINT(1) DEFAULT 0 COMMENT '是否置顶',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_posts_user_id (user_id),
  INDEX idx_posts_created_at (created_at),
  INDEX idx_posts_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 动态附件表（图片/视频）
CREATE TABLE IF NOT EXISTS post_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL COMMENT '关联帖子ID',
  type ENUM('image', 'video') NOT NULL COMMENT '附件类型',
  url VARCHAR(1000) NOT NULL COMMENT '附件URL',
  thumbnail_url VARCHAR(1000) COMMENT '缩略图URL（视频封面）',
  width INT DEFAULT 0 COMMENT '宽度',
  height INT DEFAULT 0 COMMENT '高度',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_attachments_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 帖子点赞表
CREATE TABLE IF NOT EXISTS post_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL COMMENT '帖子ID',
  user_id INT NOT NULL COMMENT '点赞用户ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_post_user (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_likes_post_id (post_id),
  INDEX idx_likes_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 帖子链接预览表（用于保存链接解析结果）
CREATE TABLE IF NOT EXISTS post_link_previews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL COMMENT '关联帖子ID',
  url VARCHAR(1000) NOT NULL COMMENT '链接URL',
  title VARCHAR(500) COMMENT '链接标题',
  description TEXT COMMENT '链接描述',
  image_url VARCHAR(1000) COMMENT '链接预览图',
  site_name VARCHAR(100) COMMENT '站点名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_link_post_id (post_id),
  INDEX idx_link_url (url(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;