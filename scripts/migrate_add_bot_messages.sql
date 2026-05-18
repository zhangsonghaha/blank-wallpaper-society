-- 机器人消息留痕表
-- 记录机器人发送和接收的所有消息，用于审计和展示
CREATE TABLE IF NOT EXISTS bot_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bot_config_id INT NOT NULL COMMENT '关联的机器人配置ID',
  direction ENUM('outbound', 'inbound') NOT NULL COMMENT '消息方向: outbound=发送, inbound=接收',
  platform VARCHAR(50) NOT NULL COMMENT '平台类型: feishu/qq/dingtalk/wechat_work/slack/custom',
  chat_id VARCHAR(200) DEFAULT NULL COMMENT '群聊/频道ID',
  sender_id VARCHAR(200) DEFAULT NULL COMMENT '发送者ID（接收消息时为对方用户ID）',
  sender_name VARCHAR(200) DEFAULT NULL COMMENT '发送者名称',
  message_type VARCHAR(50) DEFAULT 'text' COMMENT '消息类型: text/interactive/post/markdown等',
  title VARCHAR(500) DEFAULT NULL COMMENT '消息标题（发送通知时的事件标题）',
  content TEXT DEFAULT NULL COMMENT '消息内容',
  event_type VARCHAR(50) DEFAULT NULL COMMENT '事件类型: system/like/comment/review/follow/achievement/favorite/crawl/upload/chat',
  status ENUM('success', 'failed', 'pending') DEFAULT 'success' COMMENT '发送状态',
  error_message VARCHAR(500) DEFAULT NULL COMMENT '失败时的错误信息',
  -- 元数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '消息时间',
  INDEX idx_bot_config_id (bot_config_id),
  INDEX idx_direction (direction),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at),
  INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='机器人消息留痕表';