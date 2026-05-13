-- API开放平台相关表
-- 执行时间: 2026-05-14

-- API Key表
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  key_hash VARCHAR(64) NOT NULL COMMENT 'SHA256哈希',
  key_prefix VARCHAR(8) NOT NULL COMMENT '前缀用于识别',
  name VARCHAR(100) NOT NULL COMMENT 'Key名称',
  rate_limit INT DEFAULT 1000 COMMENT '每日请求上限',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_key_hash (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API使用日志表
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  api_key_id INT NOT NULL,
  endpoint VARCHAR(200),
  ip_address VARCHAR(45),
  status_code INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_key_created (api_key_id, created_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;