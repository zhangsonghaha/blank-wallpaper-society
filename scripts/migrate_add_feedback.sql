-- 用户反馈机制

CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  content TEXT NOT NULL,
  page_url VARCHAR(500) DEFAULT NULL,
  category ENUM('bug', 'feature', 'improvement', 'other') DEFAULT 'other',
  status ENUM('pending', 'in_progress', 'resolved', 'closed') DEFAULT 'pending',
  screenshot_url VARCHAR(500) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_by INT DEFAULT NULL,
  resolution_note TEXT DEFAULT NULL,
  INDEX idx_feedback_status (status),
  INDEX idx_feedback_user (user_id),
  INDEX idx_feedback_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;