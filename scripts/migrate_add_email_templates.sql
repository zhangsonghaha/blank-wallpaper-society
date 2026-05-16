-- 邮件模板管理迁移脚本
-- 创建邮件模板表，支持自定义邮件内容和动态变量

CREATE TABLE IF NOT EXISTS email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL UNIQUE COMMENT '模板唯一标识(如 welcome, password_reset, review_result)',
  name VARCHAR(200) NOT NULL COMMENT '模板名称',
  description VARCHAR(500) COMMENT '模板描述',
  subject VARCHAR(500) NOT NULL COMMENT '邮件主题(支持变量)',
  body_html TEXT NOT NULL COMMENT 'HTML邮件正文(支持变量)',
  body_text TEXT COMMENT '纯文本邮件正文(支持变量)',
  variables JSON COMMENT '模板可用变量定义 [{key, label, example}]',
  category ENUM('auth', 'review', 'notification', 'system', 'social') DEFAULT 'system' COMMENT '模板分类',
  is_builtin TINYINT(1) DEFAULT 0 COMMENT '是否系统内置模板(不可删除)',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (template_key),
  INDEX idx_category (category),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 插入默认邮件模板
INSERT IGNORE INTO email_templates (template_key, name, description, subject, body_html, body_text, variables, category, is_builtin) VALUES
(
  'welcome',
  '欢迎注册邮件',
  '用户注册成功后发送的欢迎邮件',
  '欢迎加入壁纸社区，{{user_name}}！',
  '<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;padding:20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
    <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">欢迎加入，{{user_name}}！🎉</h2>
    <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
      感谢您注册壁纸社区！在这里您可以：
    </p>
    <ul style="color:#666;font-size:16px;line-height:2;margin:0 0 24px;padding-left:20px;">
      <li>上传和分享精美壁纸</li>
      <li>浏览和收藏海量高清壁纸</li>
      <li>关注其他创作者，获取最新作品</li>
      <li>参与社区互动，解锁成就</li>
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{site_url}}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
        开始探索
      </a>
    </div>
  </div>
  <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
    <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
    <p style="margin:4px 0 0;">© {{current_year}} 壁纸社区 {{site_url}}</p>
  </div>
</div>',
  '欢迎加入壁纸社区，{{user_name}}！\n\n感谢您注册壁纸社区！您可以上传和分享精美壁纸、浏览和收藏海量高清壁纸、关注其他创作者以及参与社区互动。\n\n开始探索：{{site_url}}',
  '[{"key":"user_name","label":"用户名","example":"小明"},{"key":"user_email","label":"用户邮箱","example":"user@example.com"},{"key":"site_url","label":"网站地址","example":"https://example.com"},{"key":"current_year","label":"当前年份","example":"2026"}]',
  'auth',
  1
),
(
  'password_reset',
  '密码重置邮件',
  '用户请求重置密码时发送的邮件',
  '重置您的密码 - 壁纸社区',
  '<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;padding:20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
    <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">重置您的密码</h2>
    <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 24px;">
      我们收到了您的密码重置请求。请点击下方按钮重置密码：
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{reset_url}}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
        重置密码
      </a>
    </div>
    <p style="color:#999;font-size:14px;line-height:1.6;margin:16px 0 0;">
      如果按钮无法点击，请复制以下链接到浏览器打开：<br/>
      <a href="{{reset_url}}" style="color:#0070f3;word-break:break-all;">{{reset_url}}</a>
    </p>
    <p style="color:#999;font-size:14px;line-height:1.6;margin:16px 0 0;">
      此链接将在 1 小时后过期。如果您没有请求重置密码，请忽略此邮件。
    </p>
  </div>
  <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
    <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
    <p style="margin:4px 0 0;">© {{current_year}} 壁纸社区 {{site_url}}</p>
  </div>
</div>',
  '重置您的密码\n\n请访问以下链接重置密码：{{reset_url}}\n\n此链接将在 1 小时后过期。如果您没有请求重置密码，请忽略此邮件。',
  '[{"key":"user_name","label":"用户名","example":"小明"},{"key":"user_email","label":"用户邮箱","example":"user@example.com"},{"key":"reset_url","label":"重置链接","example":"https://example.com/reset-password?token=xxx"},{"key":"site_url","label":"网站地址","example":"https://example.com"},{"key":"current_year","label":"当前年份","example":"2026"}]',
  'auth',
  1
),
(
  'review_approved',
  '审核通过邮件',
  '壁纸审核通过时发送的邮件',
  '壁纸审核通过：{{image_title}}',
  '<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;padding:20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
    <h2 style="color:#16a34a;font-size:20px;margin:0 0 16px;">
      ✅ 审核通过
    </h2>
    <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px;">
      您上传的壁纸「<strong>{{image_title}}</strong>」已通过审核，现在可以在社区中展示！
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{site_url}}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
        查看我的壁纸
      </a>
    </div>
  </div>
  <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
    <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
    <p style="margin:4px 0 0;">© {{current_year}} 壁纸社区 {{site_url}}</p>
  </div>
</div>',
  '壁纸审核通过：{{image_title}}\n\n您上传的壁纸「{{image_title}}」已通过审核，现在可以在社区中展示！\n\n查看我的壁纸：{{site_url}}',
  '[{"key":"user_name","label":"用户名","example":"小明"},{"key":"user_email","label":"用户邮箱","example":"user@example.com"},{"key":"image_title","label":"壁纸标题","example":"美丽风景"},{"key":"image_id","label":"壁纸ID","example":"123"},{"key":"review_comment","label":"审核备注","example":"优质内容"},{"key":"site_url","label":"网站地址","example":"https://example.com"},{"key":"current_year","label":"当前年份","example":"2026"}]',
  'review',
  1
),
(
  'review_rejected',
  '审核未通过邮件',
  '壁纸审核未通过时发送的邮件',
  '壁纸审核未通过：{{image_title}}',
  '<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;padding:20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
    <h2 style="color:#dc2626;font-size:20px;margin:0 0 16px;">
      ❌ 审核未通过
    </h2>
    <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px;">
      您上传的壁纸「<strong>{{image_title}}</strong>」未通过审核。
    </p>
    <p style="color:#666;font-size:16px;line-height:1.6;margin:0 0 16px;">原因：{{review_reason}}</p>
    <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 16px;">请检查图片是否符合社区规范，修改后可重新提交。</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{site_url}}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
        重新上传
      </a>
    </div>
  </div>
  <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
    <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
    <p style="margin:4px 0 0;">© {{current_year}} 壁纸社区 {{site_url}}</p>
  </div>
</div>',
  '壁纸审核未通过：{{image_title}}\n\n您上传的壁纸「{{image_title}}」未通过审核。原因：{{review_reason}}\n\n请检查图片是否符合社区规范，修改后可重新提交。\n\n重新上传：{{site_url}}',
  '[{"key":"user_name","label":"用户名","example":"小明"},{"key":"user_email","label":"用户邮箱","example":"user@example.com"},{"key":"image_title","label":"壁纸标题","example":"美丽风景"},{"key":"image_id","label":"壁纸ID","example":"123"},{"key":"review_reason","label":"拒绝原因","example":"图片模糊"},{"key":"review_comment","label":"审核备注","example":"请提高图片质量"},{"key":"site_url","label":"网站地址","example":"https://example.com"},{"key":"current_year","label":"当前年份","example":"2026"}]',
  'review',
  1
),
(
  'notification_generic',
  '通用通知邮件',
  '站内通知的邮件版本，用于各种通知类型的邮件推送',
  '{{notification_title}} - 壁纸社区',
  '<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;padding:20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#1a1a1a;font-size:24px;margin:0;">壁纸社区</h1>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
    <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">{{notification_title}}</h2>
    <p style="color:#666;font-size:16px;line-height:1.6;margin:0;">
      {{notification_content}}
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="{{site_url}}" style="background:#0070f3;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:16px;display:inline-block;">
        查看详情
      </a>
    </div>
  </div>
  <div style="text-align:center;margin-top:24px;color:#999;font-size:12px;">
    <p style="margin:0;">此邮件由系统自动发送，请勿回复。</p>
    <p style="margin:4px 0 0;">© {{current_year}} 壁纸社区 {{site_url}}</p>
  </div>
</div>',
  '{{notification_title}}\n\n{{notification_content}}\n\n查看详情：{{site_url}}',
  '[{"key":"user_name","label":"用户名","example":"小明"},{"key":"user_email","label":"用户邮箱","example":"user@example.com"},{"key":"notification_title","label":"通知标题","example":"有人收藏了你的壁纸"},{"key":"notification_content","label":"通知内容","example":"小红收藏了你的壁纸「美丽风景」"},{"key":"notification_type","label":"通知类型","example":"favorite"},{"key":"site_url","label":"网站地址","example":"https://example.com"},{"key":"current_year","label":"当前年份","example":"2026"}]',
  'notification',
  1
);