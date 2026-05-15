-- 用户等级表
CREATE TABLE IF NOT EXISTS user_levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  title VARCHAR(50) DEFAULT '新手',
  badges JSON DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 成就定义表
CREATE TABLE IF NOT EXISTS achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'general',
  condition_type VARCHAR(50) NOT NULL,
  condition_value INT NOT NULL DEFAULT 1,
  exp_reward INT NOT NULL DEFAULT 10
);

-- 用户成就记录表
CREATE TABLE IF NOT EXISTS user_achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  achievement_id INT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_achievement (user_id, achievement_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
);

-- 初始化成就数据
INSERT IGNORE INTO achievements (slug, name, description, icon, category, condition_type, condition_value, exp_reward) VALUES
('first_upload', '初出茅庐', '首次上传壁纸', 'upload', 'upload', 'upload_count', 1, 10),
('ten_uploads', '勤劳上传', '累计上传10张壁纸', 'upload', 'upload', 'upload_count', 10, 50),
('fifty_uploads', '高产创作者', '累计上传50张壁纸', 'award', 'upload', 'upload_count', 50, 200),
('hundred_downloads', '百次下载', '壁纸被下载100次', 'download', 'contribution', 'download_count', 100, 100),
('thousand_downloads', '千次下载', '壁纸被下载1000次', 'trophy', 'contribution', 'download_count', 1000, 500),
('first_favorite', '初次认可', '壁纸被收藏1次', 'heart', 'contribution', 'favorite_count', 1, 10),
('fifty_favorites', '广受好评', '壁纸被收藏50次', 'star', 'contribution', 'favorite_count', 50, 200),
('first_follow', '有人关注', '获得1个粉丝', 'users', 'social', 'follower_count', 1, 10),
('ten_followers', '小有名气', '获得10个粉丝', 'users', 'social', 'follower_count', 10, 100),
('daily_checkin', '每日签到', '连续签到7天', 'calendar', 'engagement', 'checkin_streak', 7, 30),
('week_checkin', '坚持签到', '连续签到30天', 'flame', 'engagement', 'checkin_streak', 30, 150),
('collector', '收藏达人', '收藏50张壁纸', 'bookmark', 'engagement', 'collection_count', 50, 50);

CREATE INDEX idx_user_levels_user ON user_levels(user_id);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);