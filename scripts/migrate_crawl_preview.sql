-- 爬虫预览选择入库 - 新建预览表
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_crawl_preview.sql
-- 已通过 MCP 在 2026-06-02 执行完毕

CREATE TABLE IF NOT EXISTS crawl_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_url VARCHAR(2048) DEFAULT NULL COMMENT '爬取来源URL',
  source_type VARCHAR(64) DEFAULT NULL COMMENT '固定源名称（wallhaven等）',
  category VARCHAR(64) DEFAULT NULL COMMENT '分类',
  tags VARCHAR(512) DEFAULT NULL COMMENT '标签',
  crawl_log_id INT DEFAULT NULL COMMENT '关联 crawl_logs 表',
  total_count INT DEFAULT 0 COMMENT '爬取到的图片总数',
  selected_count INT DEFAULT 0 COMMENT '用户选中的数量',
  imported_count INT DEFAULT 0 COMMENT '成功入库的数量',
  status ENUM('pending','importing','completed','discarded') DEFAULT 'pending' COMMENT '会话状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_crawl_log_id (crawl_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬虫预览会话表';

CREATE TABLE IF NOT EXISTS crawl_preview_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL COMMENT '关联 crawl_sessions.id',
  source_url TEXT COMMENT '原始图片/视频URL',
  title VARCHAR(512) DEFAULT NULL COMMENT '图片标题',
  width INT DEFAULT 0 COMMENT '宽度',
  height INT DEFAULT 0 COMMENT '高度',
  file_size BIGINT DEFAULT 0 COMMENT '文件大小（字节）',
  mime_type VARCHAR(64) DEFAULT NULL COMMENT 'MIME类型',
  media_type ENUM('image','video') DEFAULT 'image' COMMENT '媒体类型',
  is_selected TINYINT(1) DEFAULT 0 COMMENT '是否被用户选中',
  source VARCHAR(100) DEFAULT NULL COMMENT '爬取来源（如域名）',
  tags VARCHAR(500) DEFAULT NULL COMMENT '标签，逗号分隔',
  category VARCHAR(64) DEFAULT NULL COMMENT '分类',
  video_url TEXT DEFAULT NULL COMMENT '视频原始URL',
  poster_url TEXT DEFAULT NULL COMMENT '封面图URL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_selected (session_id, is_selected),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (session_id) REFERENCES crawl_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬虫预览项表';
