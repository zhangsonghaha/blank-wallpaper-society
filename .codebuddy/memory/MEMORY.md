# 长期记忆

## 项目技术栈
- Next.js + TypeScript
- NextAuth v5 (Auth.js) JWT 认证
- Tailwind CSS v4 (CSS-first 配置)
- GSAP 动画（登录页开场动画）
- MySQL (MariaDB) + 自定义 query 封装
- Redis (ioredis)
- Altcha 人机验证
- sonner 提示

## 认证架构
- 登录/注册合并为单页，位于 `/login`
- `/register` 重定向到 `/login?mode=register`
- 仅支持邮箱+密码凭据登录
- OAuth: Google + GitHub（凭据读取 ENV > 数据库 system_settings）
- CSRF: Double Submit Cookie 模式
- 登录安全: 5次失败锁定15分钟 + IP限流
