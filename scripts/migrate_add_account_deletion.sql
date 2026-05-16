-- 账号注销与数据删除功能数据库迁移脚本
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_add_account_deletion.sql

-- 1. 在 users 表添加注销相关字段
ALTER TABLE users
  ADD COLUMN deletion_requested_at DATETIME DEFAULT NULL COMMENT '注销请求时间',
  ADD COLUMN deletion_scheduled_at DATETIME DEFAULT NULL COMMENT '计划删除时间（7天冷静期后）';

-- 2. 修改 users 表 status 字段，扩展状态值
-- 原有 status 为 varchar(20)，新增 suspended/pending_deletion/deleted 值
-- 无需修改列类型，仅确保 varchar(20) 足够存储新状态值

-- 3. 创建账号注销日志表
CREATE TABLE IF NOT EXISTS account_deletion_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '用户ID',
  action ENUM('requested', 'cancelled', 'completed', 'admin_suspended', 'admin_deleted') NOT NULL COMMENT '操作类型',
  details TEXT COMMENT '操作详情',
  operator_id INT DEFAULT NULL COMMENT '操作者ID（管理员操作时）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账号注销日志';