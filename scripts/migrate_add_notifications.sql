-- 通知系统迁移脚本
-- 创建通知表，支持站内通知功能

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '接收通知的用户',
  type ENUM('system', 'like', 'comment', 'review', 'follow') NOT NULL COMMENT '通知类型',
  title VARCHAR(200) NOT NULL COMMENT '通知标题',
  content TEXT COMMENT '通知内容',
  related_id INT COMMENT '关联资源ID(如图片ID)',
  related_type ENUM('image', 'user', 'collection', 'report') COMMENT '关联资源类型',
  is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;