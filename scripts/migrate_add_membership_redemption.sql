-- =====================================================
-- 会员兑换码系统迁移脚本
-- 功能：兑换码生成/管理、给用户发放会员、到期监控
-- =====================================================

-- 1. 会员兑换码表
CREATE TABLE IF NOT EXISTS membership_redeem_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE COMMENT '兑换码（唯一）',
  plan ENUM('monthly', 'yearly') NOT NULL COMMENT '对应的会员套餐',
  duration_days INT NOT NULL COMMENT '有效天数（月=30，年=365）',
  max_uses INT NOT NULL DEFAULT 1 COMMENT '最大兑换次数（1=一次性码，N=批量码）',
  used_count INT NOT NULL DEFAULT 0 COMMENT '已兑换次数',
  created_by INT NOT NULL COMMENT '创建者（管理员ID）',
  batch_name VARCHAR(100) NULL COMMENT '批次名称（便于管理）',
  note VARCHAR(500) NULL COMMENT '备注说明',
  expires_at DATETIME NULL COMMENT '兑换码本身的过期时间（NULL=永不过期）',
  status ENUM('active', 'disabled', 'expired') NOT NULL DEFAULT 'active' COMMENT '兑换码状态',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_code (code),
  INDEX idx_status (status),
  INDEX idx_created_by (created_by),
  INDEX idx_batch (batch_name),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员兑换码表';

-- 2. 兑换记录表
CREATE TABLE IF NOT EXISTS membership_redeem_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code_id INT NOT NULL COMMENT '兑换码ID',
  code VARCHAR(32) NOT NULL COMMENT '兑换码（便于查询）',
  user_id INT NOT NULL COMMENT '兑换用户ID',
  plan ENUM('monthly', 'yearly') NOT NULL COMMENT '兑换的套餐',
  duration_days INT NOT NULL COMMENT '获得的天数',
  membership_id INT NULL COMMENT '关联的会员记录ID',
  redeemed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_code_id (code_id),
  INDEX idx_user_id (user_id),
  INDEX idx_redeemed_at (redeemed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员兑换记录表';

-- 3. 给 memberships 表添加来源字段
ALTER TABLE memberships ADD COLUMN source ENUM('payment', 'admin_grant', 'redeem_code') NOT NULL DEFAULT 'payment' COMMENT '会员来源：支付/管理员发放/兑换码' AFTER auto_renew;
ALTER TABLE memberships ADD COLUMN granted_by INT NULL COMMENT '发放者（管理员ID）' AFTER source;
ALTER TABLE memberships ADD COLUMN redeem_code_id INT NULL COMMENT '兑换码ID（来源为兑换码时）' AFTER granted_by;

-- 4. 扩展 notifications.type 添加会员相关通知类型
ALTER TABLE notifications MODIFY COLUMN type ENUM('system','like','comment','review','follow','achievement','favorite','membership_expiring','membership_granted','membership_redeem') NOT NULL;

-- 5. 扩展 admin_operation_logs.operation 添加会员相关操作
-- MySQL ENUM 不能直接 ALTER 扩展，需要替换整个 ENUM
ALTER TABLE admin_operation_logs MODIFY COLUMN operation VARCHAR(50) NOT NULL COMMENT '操作类型';