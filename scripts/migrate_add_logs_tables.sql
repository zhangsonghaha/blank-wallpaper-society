-- 下载/浏览记录表
CREATE TABLE IF NOT EXISTS download_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_id INT NOT NULL,
  user_id INT,
  ip_address VARCHAR(45),
  resolution VARCHAR(20),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_image_created (image_id, created_at),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS view_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_id INT NOT NULL,
  user_id INT,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_image_created (image_id, created_at),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 日志归档：超过90天的日志可以归档
-- 归档脚本示例（可定期执行）：
-- INSERT INTO download_logs_archive SELECT * FROM download_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
-- DELETE FROM download_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);