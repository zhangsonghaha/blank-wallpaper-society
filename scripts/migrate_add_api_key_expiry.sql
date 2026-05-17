-- API Key 安全增强：添加过期时间字段
-- 执行时间: 2026-05-17

-- 添加 expires_at 字段，NULL 表示永不过期
ALTER TABLE api_keys
  ADD COLUMN expires_at DATETIME NULL COMMENT '过期时间，NULL表示永不过期' AFTER last_used_at;

-- 添加索引以便定期清理过期Key
CREATE INDEX idx_expires_at ON api_keys(expires_at);