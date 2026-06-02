-- 主题专区-手动图片关联表
CREATE TABLE IF NOT EXISTS theme_zone_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_key VARCHAR(30) NOT NULL,
  image_id INT NOT NULL,
  sort_order INT DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_zone_image (zone_key, image_id),
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
  INDEX idx_zone_key (zone_key)
);
