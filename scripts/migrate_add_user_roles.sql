-- =====================================================
-- 迁移脚本: 扩展用户角色系统
-- 日期: 2026-05-14
-- 描述: 
--   1. 将 role 字段从 ENUM('admin','user') 扩展为 
--      ENUM('admin','moderator','creator','user')
--   2. 添加 status 字段 (active/banned)
--   3. 添加 banned_reason 字段记录封禁原因
--   4. 添加 banned_at 字段记录封禁时间
--   5. 创建 admin_operation_logs 表记录管理操作
-- =====================================================

-- 1. 修改 role 字段，扩展角色类型
ALTER TABLE users 
  MODIFY COLUMN role ENUM('admin', 'moderator', 'creator', 'user') NOT NULL DEFAULT 'user';

-- 2. 添加 status 字段
ALTER TABLE users 
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER role;

-- 3. 添加封禁原因字段
ALTER TABLE users 
  ADD COLUMN banned_reason VARCHAR(500) NULL AFTER status;

-- 4. 添加封禁时间字段
ALTER TABLE users 
  ADD COLUMN banned_at TIMESTAMP NULL AFTER banned_reason;

-- 5. 创建管理操作日志表
CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operator_id INT NOT NULL COMMENT '操作者用户ID',
  target_user_id INT NULL COMMENT '被操作的用户ID',
  operation VARCHAR(50) NOT NULL COMMENT '操作类型: change_role, ban_user, unban_user, delete_user',
  detail JSON NULL COMMENT '操作详情，如 {from_role: "user", to_role: "moderator"}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operator (operator_id),
  INDEX idx_target_user (target_user_id),
  INDEX idx_operation (operation),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='管理操作日志表';

-- 6. 更新现有用户状态为 active（确保数据一致性）
UPDATE users SET status = 'active' WHERE status IS NULL OR status = '';