-- 邮件营销体系迁移
-- 新增邮件营销活动表、订阅偏好表、发送日志表

CREATE TABLE IF NOT EXISTS email_campaigns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(200) NOT NULL COMMENT '邮件主题',
  template_key VARCHAR(100) DEFAULT NULL COMMENT '关联邮件模板key',
  body_html TEXT NOT NULL COMMENT '邮件HTML内容',
  body_text TEXT DEFAULT NULL COMMENT '邮件纯文本内容',
  campaign_type ENUM('weekly_digest','activity_notice','creator_update','system') NOT NULL DEFAULT 'weekly_digest' COMMENT '营销类型',
  status ENUM('draft','scheduled','sending','completed','failed') NOT NULL DEFAULT 'draft' COMMENT '状态',
  scheduled_at TIMESTAMP NULL DEFAULT NULL COMMENT '计划发送时间',
  sent_at TIMESTAMP NULL DEFAULT NULL COMMENT '实际发送时间',
  target_count INT DEFAULT 0 COMMENT '目标接收人数',
  sent_count INT DEFAULT 0 COMMENT '已发送人数',
  open_count INT DEFAULT 0 COMMENT '打开人数',
  click_count INT DEFAULT 0 COMMENT '点击人数',
  created_by INT DEFAULT NULL COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='邮件营销活动';

CREATE TABLE IF NOT EXISTS email_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '用户ID',
  email VARCHAR(255) NOT NULL COMMENT '邮箱地址',
  unsub_token VARCHAR(64) NOT NULL UNIQUE COMMENT '退订token',
  weekly_digest TINYINT(1) DEFAULT 1 COMMENT '接收每周精选',
  activity_notice TINYINT(1) DEFAULT 1 COMMENT '接收活动通知',
  creator_update TINYINT(1) DEFAULT 0 COMMENT '接收创作者动态',
  is_unsubscribed TINYINT(1) DEFAULT 0 COMMENT '是否全局退订',
  unsubscribed_at TIMESTAMP NULL DEFAULT NULL COMMENT '退订时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_email (user_id, email),
  KEY idx_unsub_token (unsub_token)
) COMMENT='邮件订阅偏好';

CREATE TABLE IF NOT EXISTS email_campaign_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  campaign_id INT NOT NULL COMMENT '营销活动ID',
  user_id INT NOT NULL COMMENT '用户ID',
  email VARCHAR(255) NOT NULL COMMENT '邮箱地址',
  status ENUM('sent','failed','bounced','opened','clicked') NOT NULL DEFAULT 'sent' COMMENT '发送状态',
  opened_at TIMESTAMP NULL DEFAULT NULL COMMENT '打开时间',
  clicked_at TIMESTAMP NULL DEFAULT NULL COMMENT '点击时间',
  error_message TEXT DEFAULT NULL COMMENT '失败原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_campaign (campaign_id),
  KEY idx_user (user_id),
  KEY idx_status (status)
) COMMENT='营销邮件发送日志';