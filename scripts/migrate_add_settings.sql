-- 系统设置表迁移脚本
-- 创建键值对配置表，用于管理全局系统设置

CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
  setting_value TEXT COMMENT '配置值',
  description VARCHAR(255) COMMENT '配置说明',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入默认配置
INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
('site_name', 'Blank Wallpaper Society', '网站名称'),
('site_description', '高质量壁纸分享社区', '网站描述'),
('items_per_page', '24', '每页显示数量'),
('max_upload_size', '10', '最大上传大小(MB)'),
('allow_registration', 'true', '允许注册'),
('require_review', 'true', '图片需要审核'),
('max_images_per_user', '0', '用户最大上传数(0=无限制)'),
('watermark_enabled', 'false', '启用水印'),
('watermark_text', 'Blank Wallpaper', '水印文字'),
('maintenance_mode', 'false', '维护模式');