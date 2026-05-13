-- 合集功能数据库迁移脚本
-- 执行方式: mysql -u zhangsong -p img < scripts/migrate_add_collections.sql

-- 合集表
CREATE TABLE IF NOT EXISTS collections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  cover_image_id INT,
  user_id INT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL
);

-- 合集-图片关联表
CREATE TABLE IF NOT EXISTS collection_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collection_id INT NOT NULL,
  image_id INT NOT NULL,
  sort_order INT DEFAULT 0,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_collection_image (collection_id, image_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id)
);

-- 合集订阅表
CREATE TABLE IF NOT EXISTS collection_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  collection_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_collection_user (collection_id, user_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 索引
CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_is_public ON collections(is_public);
CREATE INDEX idx_collection_images_image_id ON collection_images(image_id);
CREATE INDEX idx_collection_subscriptions_user_id ON collection_subscriptions(user_id);