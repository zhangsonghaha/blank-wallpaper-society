-- 爬取历史表 - 记录每次爬取任务的详细信息
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_add_crawl_logs.sql

CREATE TABLE IF NOT EXISTS crawl_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(100) NOT NULL COMMENT '爬取源标识（如 wallhaven、自定义URL）',
  source_url VARCHAR(1000) DEFAULT NULL COMMENT '爬取的目标URL',
  crawl_mode VARCHAR(20) DEFAULT 'auto' COMMENT '爬取模式: auto/static/stealthy/random/sequential',
  category VARCHAR(100) DEFAULT NULL COMMENT '指定的分类（手动或自动识别）',
  tags VARCHAR(500) DEFAULT NULL COMMENT '指定的标签（手动或自动识别），逗号分隔',
  pages INT DEFAULT 1 COMMENT '爬取页数',
  requested_count INT DEFAULT 10 COMMENT '请求爬取数量',
  success_count INT DEFAULT 0 COMMENT '成功数量',
  fail_count INT DEFAULT 0 COMMENT '失败数量',
  dedup_skipped INT DEFAULT 0 COMMENT '去重跳过数量',
  status VARCHAR(20) DEFAULT 'running' COMMENT '任务状态: running/completed/failed',
  error_message TEXT DEFAULT NULL COMMENT '错误信息',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
  finished_at DATETIME DEFAULT NULL COMMENT '完成时间',
  duration_seconds INT DEFAULT NULL COMMENT '耗时（秒）',
  operator_id INT DEFAULT NULL COMMENT '操作人用户ID',
  INDEX idx_source (source),
  INDEX idx_category (category),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='爬取历史记录表';