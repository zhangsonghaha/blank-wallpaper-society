-- 数据库索引优化迁移
-- 日期：2026-05-17
-- 目的：为高频查询添加缺失索引，提升查询性能

-- === images 表索引优化 ===

-- uploaded_by 索引：用于"我的图片"查询和账号注销时关联查询
ALTER TABLE images ADD INDEX idx_images_uploaded_by (uploaded_by);

-- status + created_at 复合索引：用于首页按时间排序的已审核图片查询
ALTER TABLE images ADD INDEX idx_images_status_created (status, created_at);

-- category + status 复合索引：用于分类浏览页面的筛选查询
ALTER TABLE images ADD INDEX idx_images_category_status (category, status);

-- author 索引：用于每日上传限制检查（WHERE author = ? AND created_at >= ?）
ALTER TABLE images ADD INDEX idx_images_author_created (author, created_at);

-- === users 表索引优化 ===

-- status 索引：用于查找 pending_deletion 状态的用户（定时清理任务）
ALTER TABLE users ADD INDEX idx_users_status (status);

-- === comments 表索引优化 ===

-- image_id + parent_id 复合索引：用于获取顶级评论的查询
ALTER TABLE comments ADD INDEX idx_comments_image_parent (image_id, parent_id);

-- post_id + parent_id 复合索引：用于帖子顶级评论查询
ALTER TABLE comments ADD INDEX idx_comments_post_parent (post_id, parent_id);

-- === download_logs 表索引优化 ===

-- image_id 索引：用于统计图片下载量
ALTER TABLE download_logs ADD INDEX idx_download_logs_image_id (image_id);

-- user_id + created_at 复合索引：用于用户下载历史查询
ALTER TABLE download_logs ADD INDEX idx_download_logs_user_created (user_id, created_at);

-- === view_logs 表索引优化 ===

-- image_id 索引：用于统计图片浏览量
ALTER TABLE view_logs ADD INDEX idx_view_logs_image_id (image_id);

-- === orders 表索引优化 ===

-- user_id + payment_status 复合索引：用于查询用户支付记录
ALTER TABLE orders ADD INDEX idx_orders_user_status (user_id, payment_status);

-- === posts 表索引优化 ===

-- user_id 索引：用于查询用户发布的帖子
ALTER TABLE posts ADD INDEX idx_posts_user_id (user_id);

-- visibility + created_at 复合索引：用于 Feed 流按可见性筛选
ALTER TABLE posts ADD INDEX idx_posts_visibility_created (visibility, created_at);