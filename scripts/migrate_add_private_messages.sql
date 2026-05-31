-- 私信系统迁移脚本
-- 创建对话和消息表，支持实时私信功能

-- 对话表：管理两个用户之间的对话
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '对话创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间(最后消息时间)',
  INDEX idx_updated (updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 对话参与者表：记录对话中的用户
CREATE TABLE IF NOT EXISTS conversation_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL COMMENT '对话ID',
  user_id INT NOT NULL COMMENT '用户ID',
  last_read_at TIMESTAMP DEFAULT NULL COMMENT '最后已读消息时间',
  is_hidden TINYINT(1) DEFAULT 0 COMMENT '用户是否隐藏该对话',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_conv_user (conversation_id, user_id),
  INDEX idx_user_hidden (user_id, is_hidden),
  INDEX idx_user_conv (user_id, conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 消息表：存储所有私信内容
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL COMMENT '对话ID',
  sender_id INT NOT NULL COMMENT '发送者ID',
  content TEXT NOT NULL COMMENT '消息内容',
  message_type ENUM('text', 'image', 'system') DEFAULT 'text' COMMENT '消息类型',
  is_read TINYINT(1) DEFAULT 0 COMMENT '接收者是否已读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '消息发送时间',
  INDEX idx_conv_created (conversation_id, created_at DESC),
  INDEX idx_sender (sender_id),
  INDEX idx_conv_read (conversation_id, is_read),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 扩展通知类型：添加私信通知类型
ALTER TABLE notifications MODIFY COLUMN type ENUM('system', 'like', 'comment', 'review', 'follow', 'achievement', 'favorite', 'message', 'order') NOT NULL COMMENT '通知类型';
ALTER TABLE notification_settings ADD COLUMN notify_message TINYINT(1) DEFAULT 1 COMMENT '私信通知' AFTER notify_favorite;
ALTER TABLE notification_settings ADD COLUMN email_message TINYINT(1) DEFAULT 0 COMMENT '私信通知邮件' AFTER email_achievement;