-- 通知系统迁移脚本
-- 创建通知表，支持站内通知功能

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '接收通知的用户',
  type ENUM('system', 'like', 'comment', 'review', 'follow', 'achievement', 'favorite') NOT NULL COMMENT '通知类型',
  title VARCHAR(200) NOT NULL COMMENT '通知标题',
  content TEXT COMMENT '通知内容',
  related_id INT COMMENT '关联资源ID(如图片ID)',
  related_type ENUM('image', 'user', 'collection', 'report', 'achievement') COMMENT '关联资源类型',
  is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知设置表：用户可配置接收哪些类型的通知
CREATE TABLE IF NOT EXISTS notification_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE COMMENT '用户ID',
  notify_system TINYINT(1) DEFAULT 1 COMMENT '系统通知',
  notify_like TINYINT(1) DEFAULT 1 COMMENT '点赞通知',
  notify_comment TINYINT(1) DEFAULT 1 COMMENT '评论通知',
  notify_review TINYINT(1) DEFAULT 1 COMMENT '审核结果通知',
  notify_follow TINYINT(1) DEFAULT 1 COMMENT '关注通知',
  notify_achievement TINYINT(1) DEFAULT 1 COMMENT '成就解锁通知',
  notify_favorite TINYINT(1) DEFAULT 1 COMMENT '收藏通知',
  email_system TINYINT(1) DEFAULT 0 COMMENT '系统通知邮件',
  email_review TINYINT(1) DEFAULT 1 COMMENT '审核结果邮件',
  email_achievement TINYINT(1) DEFAULT 1 COMMENT '成就解锁邮件',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;