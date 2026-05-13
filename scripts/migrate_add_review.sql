-- =====================================================
-- P0-2 内容审核系统数据库迁移脚本
-- 执行方式: mysql -u zhangsong -p img < migrate_add_review.sql
-- =====================================================

-- 1. 为 images 表添加审核相关字段（如果不存在）
ALTER TABLE images
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' COMMENT '审核状态: pending/approved/rejected',
  ADD COLUMN IF NOT EXISTS reviewed_by INT DEFAULT NULL COMMENT '审核人ID',
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME DEFAULT NULL COMMENT '审核时间',
  ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(500) DEFAULT NULL COMMENT '拒绝原因';

-- 2. 将现有图片状态设为 approved（已有内容应默认通过）
UPDATE images SET status = 'approved' WHERE status = 'pending' AND reviewed_by IS NULL;

-- 3. 创建举报表 reports
CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_id INT NOT NULL COMMENT '被举报的图片ID',
  reporter_id INT NOT NULL COMMENT '举报人ID',
  reason VARCHAR(500) NOT NULL COMMENT '举报原因',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '举报状态: pending/reviewed/resolved',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '举报时间',
  resolved_by INT DEFAULT NULL COMMENT '处理人ID',
  resolved_at DATETIME DEFAULT NULL COMMENT '处理时间',
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图片举报表';

-- 4. 为 status 字段创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_image_id ON reports(image_id);