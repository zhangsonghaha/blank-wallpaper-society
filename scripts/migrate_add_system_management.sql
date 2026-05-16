-- 系统管理相关表迁移脚本
-- 菜单管理、角色管理、通知公告

-- 1. 菜单管理表
CREATE TABLE IF NOT EXISTS `sys_menus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `parent_id` INT DEFAULT 0 COMMENT '父菜单ID，0为顶级菜单',
  `name` VARCHAR(100) NOT NULL COMMENT '菜单名称',
  `path` VARCHAR(200) DEFAULT '' COMMENT '路由路径',
  `icon` VARCHAR(100) DEFAULT '' COMMENT '菜单图标',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序，越小越靠前',
  `is_visible` TINYINT(1) DEFAULT 1 COMMENT '是否可见 1:可见 0:隐藏',
  `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用 1:启用 0:禁用',
  `type` ENUM('directory','menu','button') DEFAULT 'menu' COMMENT '菜单类型:目录/菜单/按钮',
  `permission` VARCHAR(100) DEFAULT '' COMMENT '权限标识',
  `component` VARCHAR(200) DEFAULT '' COMMENT '组件路径',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_parent_id` (`parent_id`),
  INDEX `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统菜单表';

-- 2. 角色管理表
CREATE TABLE IF NOT EXISTS `sys_roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL COMMENT '角色名称',
  `code` VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码',
  `description` VARCHAR(255) DEFAULT '' COMMENT '角色描述',
  `is_enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用 1:启用 0:禁用',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色表';

-- 3. 角色-菜单关联表
CREATE TABLE IF NOT EXISTS `sys_role_menus` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT NOT NULL COMMENT '角色ID',
  `menu_id` INT NOT NULL COMMENT '菜单ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_role_menu` (`role_id`, `menu_id`),
  INDEX `idx_role_id` (`role_id`),
  INDEX `idx_menu_id` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

-- 4. 通知公告表
CREATE TABLE IF NOT EXISTS `sys_announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(200) NOT NULL COMMENT '公告标题',
  `content` TEXT NOT NULL COMMENT '公告内容',
  `type` ENUM('notice','announcement','maintenance') DEFAULT 'notice' COMMENT '类型:通知/公告/维护',
  `priority` ENUM('low','normal','high','urgent') DEFAULT 'normal' COMMENT '优先级',
  `is_published` TINYINT(1) DEFAULT 0 COMMENT '是否发布 1:已发布 0:草稿',
  `start_time` TIMESTAMP NULL COMMENT '生效开始时间',
  `end_time` TIMESTAMP NULL COMMENT '生效结束时间',
  `author_id` INT COMMENT '发布人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type` (`type`),
  INDEX `idx_published` (`is_published`),
  INDEX `idx_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知公告表';

-- 5. 插入初始菜单数据
INSERT INTO `sys_menus` (`id`, `parent_id`, `name`, `path`, `icon`, `sort_order`, `is_visible`, `is_enabled`, `type`, `permission`, `component`) VALUES
-- 内容管理
(1, 0, '内容管理', '/admin', 'FolderTree', 1, 1, 1, 'directory', '', ''),
(2, 1, '图片管理', 'images', 'ImageIcon', 1, 1, 1, 'menu', 'content:images', 'ImagesTab'),
(3, 1, '分类管理', 'categories', 'FolderTree', 2, 1, 1, 'menu', 'content:categories', 'CategoriesTab'),
(4, 1, '审核管理', 'review', 'ShieldCheck', 3, 1, 1, 'menu', 'content:review', 'ReviewTab'),
(5, 1, '举报管理', 'reports', 'FileText', 4, 1, 1, 'menu', 'content:reports', 'ReportTab'),
(6, 1, '爬虫管理', 'crawl', 'Bug', 5, 1, 1, 'menu', 'content:crawl', 'CrawlTab'),
(7, 1, '挑战赛管理', 'challenges', 'Trophy', 6, 1, 1, 'menu', 'content:challenges', 'ChallengesTab'),
-- 运营管理
(8, 0, '运营管理', '/admin', 'BarChart3', 2, 1, 1, 'directory', '', ''),
(9, 8, '仪表盘', 'dashboard', 'LayoutDashboard', 1, 1, 1, 'menu', 'ops:dashboard', 'DashboardTab'),
(10, 8, 'API用量', 'api-usage', 'BarChart3', 2, 1, 1, 'menu', 'ops:api-usage', 'ApiUsageTab'),
(11, 8, '邮件模板', 'email-templates', 'Mail', 3, 1, 1, 'menu', 'ops:email-templates', 'EmailTemplatesTab'),
-- 系统管理
(12, 0, '系统管理', '/admin', 'Settings', 3, 1, 1, 'directory', '', ''),
(13, 12, '菜单管理', 'menu-management', 'Menu', 1, 1, 1, 'menu', 'system:menu', 'MenuManagementTab'),
(14, 12, '角色管理', 'role-management', 'UserCog', 2, 1, 1, 'menu', 'system:role', 'RoleManagementTab'),
(15, 12, '用户管理', 'users', 'Users', 3, 1, 1, 'menu', 'system:users', 'UsersTab'),
(16, 12, '通知公告', 'announcements', 'Bell', 4, 1, 1, 'menu', 'system:announcements', 'AnnouncementsTab'),
(17, 12, '系统设置', 'settings', 'Settings', 5, 1, 1, 'menu', 'system:settings', 'SettingsTab');

-- 6. 插入初始角色数据
INSERT INTO `sys_roles` (`id`, `name`, `code`, `description`, `is_enabled`, `sort_order`) VALUES
(1, '超级管理员', 'admin', '拥有系统所有权限', 1, 1),
(2, '审核员', 'moderator', '负责内容审核管理', 1, 2),
(3, '普通用户', 'user', '普通注册用户', 1, 3);