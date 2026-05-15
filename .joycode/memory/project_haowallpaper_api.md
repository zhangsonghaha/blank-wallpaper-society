---
name: haowallpaper-api
description: haowallpaper API 和下载认证机制分析结果
type: project
---

**Altcha PoW验证可自动通过，实现无登录高清下载。** 流程：1)访问详情页获取askId cookie(匿名token) 2)GET /link/pc/certify/challenge获取SHA-256 PoW挑战 3)用altcha-lib-py求解(0.1秒) 4)POST /link/pc/certify/verify提交验证 5)GET /link/common/file/getCompleteUrl/{wtId}+token header获取CDN下载URL 6)下载高清MP4。匿名用户每日有下载次数限制(305状态码)。
**Why:** 深入分析JS源码发现Altcha V1 PoW(SHA-256,maxnumber=160000)可纯Python求解，askId cookie作为匿名token传递给API。
**How to apply:** 爬虫已集成_solve_altcha_download()函数，自动完成Altcha验证+高清下载。无需--cookies参数。遇到305时回退预览版本。安装altcha库: pip install altcha。