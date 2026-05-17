-- 机器人通知配置表（飞书/QQ等）
-- 支持多种机器人类型，每种可配置多个实例
CREATE TABLE IF NOT EXISTS bot_configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '机器人名称（便于管理）',
  type ENUM('feishu', 'qq', 'dingtalk', 'wechat_work', 'slack', 'custom') NOT NULL COMMENT '机器人类型',
  webhook_url VARCHAR(500) NOT NULL COMMENT 'Webhook 地址',
  secret VARCHAR(200) DEFAULT NULL COMMENT '签名密钥（飞书/钉钉等用于验证）',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  -- 通知事件订阅（JSON 数组，如 ["review","achievement","comment","follow","favorite","system"]）
  subscribe_events JSON DEFAULT NULL COMMENT '订阅的通知事件类型',
  -- 飞书专属配置
  feishu_msg_type VARCHAR(50) DEFAULT 'interactive' COMMENT '飞书消息类型: interactive/text/post',
  -- QQ 专属配置
  qq_group_id VARCHAR(50) DEFAULT NULL COMMENT 'QQ 群号（群机器人时填写）',
  -- 自定义请求配置
  custom_method VARCHAR(10) DEFAULT 'POST' COMMENT '自定义请求方法',
  custom_headers JSON DEFAULT NULL COMMENT '自定义请求头（JSON 对象）',
  custom_body_template TEXT DEFAULT NULL COMMENT '自定义请求体模板（支持 {{title}}/{{content}}/{{type}} 变量）',
  -- 统计
  last_sent_at DATETIME DEFAULT NULL COMMENT '最后发送时间',
  send_count INT DEFAULT 0 COMMENT '累计发送次数',
  fail_count INT DEFAULT 0 COMMENT '累计失败次数',
  -- 元数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='机器人通知配置表';

-- Webhook 事件订阅表（P4-5）
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '订阅用户ID',
  url VARCHAR(500) NOT NULL COMMENT 'Webhook 回调地址',
  -- 订阅事件（JSON 数组，如 ["image.approved","image.rejected","comment.created","user.followed"]）
  events JSON NOT NULL COMMENT '订阅的事件列表',
  secret VARCHAR(200) DEFAULT NULL COMMENT '签名密钥（HMAC-SHA256 签名验证）',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  -- 投递配置
  max_retries INT DEFAULT 3 COMMENT '最大重试次数',
  retry_interval INT DEFAULT 60 COMMENT '重试间隔（秒）',
  timeout_ms INT DEFAULT 5000 COMMENT '请求超时（毫秒）',
  -- 统计
  last_delivered_at DATETIME DEFAULT NULL COMMENT '最后成功投递时间',
  delivery_count INT DEFAULT 0 COMMENT '累计投递次数',
  fail_count INT DEFAULT 0 COMMENT '累计失败次数',
  -- 元数据
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_enabled (enabled),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Webhook 事件订阅表';

-- Webhook 投递日志表
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL COMMENT '订阅ID',
  event VARCHAR(100) NOT NULL COMMENT '事件类型',
  payload JSON NOT NULL COMMENT '请求体',
  response_status INT DEFAULT NULL COMMENT 'HTTP 响应状态码',
  response_body TEXT DEFAULT NULL COMMENT '响应内容（截断）',
  attempt INT DEFAULT 1 COMMENT '第几次尝试',
  success TINYINT(1) DEFAULT 0 COMMENT '是否成功',
  delivered_at DATETIME DEFAULT NULL COMMENT '投递时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subscription (subscription_id),
  INDEX idx_event (event),
  INDEX idx_created (created_at),
  FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Webhook 投递日志表';