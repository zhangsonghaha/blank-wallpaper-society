#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
壁纸爬虫脚本 - 基于 Scrapling 自适应爬虫框架
支持两种模式：
  1. 固定源模式：从预设的壁纸平台爬取
  2. 自定义URL模式：输入任意URL，自动爬取页面中的图片

用法:
  # 自定义URL模式 - 输入任意地址爬取图片
  python scripts/crawl_with_scrapling.py --url https://example.com/wallpapers --count 10
  python scripts/crawl_with_scrapling.py --url https://example.com --mode stealthy --min-width 1920

  # 固定源模式 - 从预设平台爬取
  python scripts/crawl_with_scrapling.py --source wallhaven --mode random --count 10
  python scripts/crawl_with_scrapling.py --source unsplash --mode sequential --count 5
"""

# ====== 强制 UTF-8 编码输出（修复 Windows 中文乱码） ======
import sys
import os

if sys.platform == "win32":
    # Windows 下强制 stdout/stderr 使用 UTF-8
    os.environ["PYTHONIOENCODING"] = "utf-8"
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import argparse
import json
import time
import random
import tempfile
import hashlib
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    from scrapling.fetchers import Fetcher, StealthyFetcher, FetcherSession
except ImportError:
    print("错误: 请先安装 scrapling 库: pip install scrapling", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError:
    print("错误: 请先安装 requests 库: pip install requests", file=sys.stderr)
    sys.exit(1)


# ============================================================
# 壁纸源配置（固定源模式）
# ============================================================

CRAWL_SOURCES = {
    "wallhaven": {
        "name": "Wallhaven",
        "url": "https://wallhaven.cc",
        "description": "高质量壁纸社区，提供各种分辨率壁纸",
    },
    "unsplash": {
        "name": "Unsplash",
        "url": "https://unsplash.com",
        "description": "免费高质量图片社区",
    },
    "pexels": {
        "name": "Pexels",
        "url": "https://www.pexels.com",
        "description": "免费图片和视频素材",
    },
    "pixabay": {
        "name": "Pixabay",
        "url": "https://pixabay.com",
        "description": "免费图片和视频素材库",
    },
}

# 分类关键词映射
CATEGORY_MAP = {
    "nature": "自然风光", "landscape": "自然风光", "anime": "动漫",
    "people": "人物", "animals": "动物", "city": "城市建筑",
    "architecture": "城市建筑", "travel": "旅行", "art": "艺术",
    "abstract": "艺术", "minimal": "极简", "3d": "3D",
    "dark": "暗黑", "space": "太空", "technology": "科技",
    "food": "美食", "sports": "运动", "music": "音乐",
    "wallpaper": "壁纸", "hd": "高清", "background": "背景",
    "desktop": "桌面", "mobile": "手机",
}


# ============================================================
# 自适应页面爬取器（核心：支持任意URL）
# ============================================================

class AdaptiveCrawler:
    """自适应爬取器 - 输入任意URL，自动提取页面中的图片"""

    # 常见非媒体URL后缀（跳过）
    SKIP_EXTENSIONS = {
        '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.ico',
        '.svg', '.pdf', '.zip', '.rar', '.doc', '.docx', '.xls', '.xlsx',
    }

    # 图片后缀模式：标准后缀 + CDN 处理参数的非标准后缀
    # 匹配 .jpg, .jpeg, .png, .webp, .bmp, .gif, .avif
    # 也匹配 .jpg-pcthumbs, .jpeg_webp, .jpg_800x0, .png_small 等
    IMAGE_EXT_PATTERN = re.compile(
        r'\.(jpe?g|png|webp|bmp|gif|avif)'
        r'(?:[_\-.][\w\d]+)*'  # CDN后缀变体: -pcthumbs, _webp, _800x0, .thumb 等
        r'$'
    )

    # 视频/动态壁纸后缀模式
    VIDEO_EXT_PATTERN = re.compile(
        r'\.(mp4|webm|mov|avi|mkv)'
        r'(?:[?\-_].*)?$'
    )

    # 壁纸相关关键词（用于猜测分类）
    WALLPAPER_KEYWORDS = [
        'wallpaper', 'background', 'desktop', 'hd', '4k', '8k',
        'nature', 'landscape', 'city', 'travel', 'art', 'abstract',
        'minimal', 'dark', 'space', 'technology', 'anime', '3d',
    ]

    def __init__(self, min_width=800, min_height=600, max_images=50):
        self.min_width = min_width
        self.min_height = min_height
        self.max_images = max_images

    def crawl(self, url, mode="auto", count=10):
        """
        爬取指定URL页面中的图片

        Args:
            url: 目标页面URL
            mode: 爬取模式 - auto(自动选择)/static(静态)/stealthy(隐身浏览器)
            count: 最大图片数量
        """
        results = []
        parsed_url = urlparse(url)
        base_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"

        print(f"[Adaptive] 目标URL: {url}", file=sys.stderr)
        print(f"[Adaptive] 爬取模式: {mode}", file=sys.stderr)

        try:
            page = self._fetch_page(url, mode)
            if page is None:
                print(f"[Adaptive] 无法获取页面内容", file=sys.stderr)
                return results

            # 获取页面标题
            page_title = self._get_page_title(page)

            # 策略1: 提取 <img> 标签中的图片
            img_results = self._extract_img_tags(page, base_domain, page_title, count)
            results.extend(img_results)

            # 策略2: 如果图片不够，提取 CSS 背景图
            if len(results) < count:
                css_results = self._extract_css_backgrounds(page, base_domain, page_title, count - len(results))
                results.extend(css_results)

            # 策略3: 如果图片还不够，提取 <a> 标签中指向图片的链接
            if len(results) < count:
                link_results = self._extract_image_links(page, base_domain, page_title, count - len(results))
                results.extend(link_results)

            # 策略4: 提取 <video> 标签中的动态壁纸（始终执行，不只补充）
            video_results = self._extract_video_tags(page, base_domain, page_title, count)
            results.extend(video_results)

            # 策略5: 提取页面脚本/内嵌JSON中的视频URL
            script_video_results = self._extract_script_videos(page, base_domain, page_title, count)
            results.extend(script_video_results)

            # 去重（同时按 image_url 和 video_url 去重）
            seen_urls = set()
            unique_results = []
            for item in results:
                dedup_key = item.get("video_url") or item["image_url"]
                if dedup_key not in seen_urls:
                    seen_urls.add(dedup_key)
                    # 也把 image_url 加入去重集合，防止封面图和视频重复
                    if item["image_url"] and item["image_url"] != dedup_key:
                        seen_urls.add(item["image_url"])
                    unique_results.append(item)

            results = unique_results[:count]

            print(f"[Adaptive] 共提取 {len(results)} 张图片", file=sys.stderr)

        except Exception as e:
            print(f"[Adaptive] 爬取出错: {e}", file=sys.stderr)

        return results

    def _fetch_page(self, url, mode="auto"):
        """根据模式选择合适的 Fetcher 获取页面"""
        if mode == "stealthy":
            return self._fetch_stealthy(url)
        elif mode == "static":
            return self._fetch_static(url)
        else:
            # auto 模式：先尝试静态，失败或内容为空则回退到隐身
            page = self._fetch_static(url)
            should_fallback = page is None or self._is_empty_page(page)
            if not should_fallback:
                # 检查状态码，418表示反爬拦截
                try:
                    if hasattr(page, 'status') and page.status == 418:
                        should_fallback = True
                        print(f"[Adaptive] 静态获取返回418(反爬拦截)，回退到隐身浏览器模式...", file=sys.stderr)
                except Exception:
                    pass
            if should_fallback:
                print(f"[Adaptive] 静态获取失败或内容为空，回退到隐身浏览器模式...", file=sys.stderr)
                page = self._fetch_stealthy(url)
            return page

    def _fetch_static(self, url):
        """使用静态 Fetcher 获取页面（快速，无浏览器）"""
        try:
            print(f"[Adaptive] 尝试静态获取: {url}", file=sys.stderr)
            page = Fetcher.get(url, timeout=30)
            print(f"[Adaptive] 静态获取成功，状态码: {page.status}", file=sys.stderr)
            return page
        except Exception as e:
            print(f"[Adaptive] 静态获取失败: {e}", file=sys.stderr)
            return None

    def _fetch_stealthy(self, url):
        """使用隐身浏览器获取页面（可绕过反爬）
        注意：scrapling 的 timeout 参数单位是毫秒，默认 30000（30秒）
        """
        try:
            print(f"[Adaptive] 使用隐身浏览器获取: {url}", file=sys.stderr)

            # 定义 page_action：自动完成 WAF 滑块验证
            def auto_solve_captcha(page):
                self._solve_waf_captcha(page, url)

            # timeout 单位是毫秒！60000ms = 60秒
            page = StealthyFetcher.fetch(
                url,
                headless=True,
                timeout=60000,
                network_idle=True,
                wait=2000,
                page_action=auto_solve_captcha,
            )
            print(f"[Adaptive] 隐身浏览器获取成功，状态码: {page.status}", file=sys.stderr)

            # 检查是否仍在 WAF 验证页面
            if self._is_waf_page(page):
                print("[Adaptive] 页面仍为 WAF 验证页，尝试通过 API 直接绕过...", file=sys.stderr)
                page = self._bypass_waf_and_refetch(url, page)

            return page
        except Exception as e:
            print(f"[Adaptive] 隐身浏览器获取失败: {e}", file=sys.stderr)
            return None

    def _is_waf_page(self, page):
        """检查页面是否为 WAF 验证页"""
        if page is None:
            return False
        try:
            if hasattr(page, 'status') and page.status == 418:
                return True
            title = page.css("title::text").get() or ""
            waf_kw = ['verification page', 'waf security', 'security check', 'captcha', '验证码']
            return any(kw in title.lower() for kw in waf_kw)
        except Exception:
            return False

    def _bypass_waf_and_refetch(self, url, original_page):
        """尝试通过多种方式绕过 WAF 验证
        
        策略：
        1. 尝试 go-captcha API（利用 tile_x/tile_y 作为 point，可能对简单滑块有效）
        2. 尝试使用持久化浏览器会话（user_data_dir）保留 WAF cookie
        3. 尝试 headful 模式让用户手动完成验证
        """
        import time as _time
        import re as _re
        from urllib.parse import urljoin

        # 从原始页面提取 API_BASE_URL
        api_base_url = ""
        try:
            scripts = original_page.css("script")
            for s in scripts:
                text = s.css("::text").get() or ""
                if "API_BASE_URL" in text:
                    m = _re.search(r"API_BASE_URL\s*=\s*['\"]([^'\"]+)['\"]", text)
                    if m:
                        api_base_url = m.group(1)
                        break
        except Exception:
            pass

        if not api_base_url:
            print("[Adaptive] 未找到 WAF API URL", file=sys.stderr)
            return original_page

        full_api_base = urljoin(url, api_base_url)
        print(f"[Adaptive] WAF API: {full_api_base}", file=sys.stderr)

        # 策略1: 尝试 API 直接验证（对简单滑块可能有效）
        max_retries = 3
        for attempt in range(max_retries):
            try:
                import requests as _req
                get_resp = _req.get(f"{full_api_base}?type=get", timeout=10)
                if get_resp.status_code != 200:
                    continue

                captcha_data = get_resp.json()
                if captcha_data.get('code', -1) != 0:
                    _time.sleep(1)
                    continue

                captcha_key = captcha_data.get('captcha_key', '')
                tile_x = captcha_data.get('tile_x', 0)
                tile_y = captcha_data.get('tile_y', 0)
                tile_w = captcha_data.get('tile_width', 0)
                tile_h = captcha_data.get('tile_height', 0)
                print(f"[Adaptive] 验证码: key={captcha_key[:20]}..., tile=({tile_x}, {tile_y}), size=({tile_w}, {tile_h})", file=sys.stderr)

                # 对于 SlideRegion 类型，尝试多种 point 坐标
                # 拼图块需要被拖到缺口位置，尝试几个常见位置
                test_points = [
                    # 尝试背景图中间位置
                    (150, tile_y),
                    (200, tile_y),
                    (100, tile_y),
                    # 尝试 tile 位置偏移
                    (tile_x + 100, tile_y),
                    (tile_x + 150, tile_y),
                ]
                
                for px, py in test_points:
                    check_resp = _req.post(
                        f"{full_api_base}?type=check",
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                        data=f"point={px},{py}&key={captcha_key}",
                        timeout=10,
                    )
                    if check_resp.status_code == 200:
                        check_data = check_resp.json()
                        if check_data.get('code', -1) == 0:
                            print(f"[Adaptive] WAF 验证成功！point=({px},{py})", file=sys.stderr)
                            _time.sleep(2)
                            page = StealthyFetcher.fetch(
                                url, headless=True, timeout=60000,
                                network_idle=True, wait=2000,
                            )
                            if not self._is_waf_page(page):
                                return page
                        # 验证失败，需要重新获取 captcha
                        break
                
                print(f"[Adaptive] WAF API 验证失败({attempt+1}/{max_retries})", file=sys.stderr)
                _time.sleep(1)
            except Exception as e:
                print(f"[Adaptive] WAF API 异常({attempt+1}/{max_retries}): {e}", file=sys.stderr)
                _time.sleep(1)

        # 策略2: 使用持久化浏览器会话
        print("[Adaptive] API 验证失败，尝试使用持久化浏览器会话...", file=sys.stderr)
        try:
            import tempfile
            import os
            # 使用固定的 user_data_dir 来保存 WAF cookie
            session_dir = os.path.join(tempfile.gettempdir(), "scrapling_waf_session")
            os.makedirs(session_dir, exist_ok=True)
            
            page = StealthyFetcher.fetch(
                url, headless=True, timeout=60000,
                network_idle=True, wait=3000,
                user_data_dir=session_dir,
            )
            if not self._is_waf_page(page):
                print(f"[Adaptive] 持久化会话获取成功！状态码: {page.status}", file=sys.stderr)
                return page
            else:
                print("[Adaptive] 持久化会话仍为 WAF 页面", file=sys.stderr)
        except Exception as e:
            print(f"[Adaptive] 持久化会话异常: {e}", file=sys.stderr)

        print("[Adaptive] WAF 验证所有策略均失败，返回原始页面", file=sys.stderr)
        return original_page

    def _solve_waf_captcha(self, page, url):
        """自动完成 WAF 滑块验证（如哲风科技 go-captcha 等）
        
        核心思路：go-captcha 的 ?type=get API 会返回 tile_x/tile_y（拼图目标位置），
        我们可以直接用这个坐标提交验证，无需图像识别。
        
        流程：
        1. 从页面 JS 中提取 API_BASE_URL
        2. GET ?type=get → 获取 captcha_key + tile_x + tile_y
        3. POST ?type=check → 提交 point=tile_x,tile_y&key=captcha_key
        4. 验证成功后刷新页面
        """
        import time as _time
        try:
            # 检查是否是验证页面
            title = ""
            try:
                title_el = page.query_selector('title')
                if title_el:
                    title = title_el.inner_text() or ""
            except Exception:
                pass

            is_waf = any(kw in title.lower() for kw in ['verification', 'waf', 'security check', 'captcha', '验证'])
            if not is_waf:
                return  # 不是验证页面，无需处理

            print(f"[Adaptive] 检测到 WAF 验证页面: {title[:60]}", file=sys.stderr)

            # ===== 方法1: 利用 go-captcha API 漏洞 =====
            # 从页面 JS 中提取 API_BASE_URL
            api_base_url = ""
            try:
                scripts = page.css("script")
                for s in scripts:
                    text = s.css("::text").get() or ""
                    if "API_BASE_URL" in text:
                        import re as _re
                        m = _re.search(r"API_BASE_URL\s*=\s*['\"]([^'\"]+)['\"]", text)
                        if m:
                            api_base_url = m.group(1)
                            break
            except Exception:
                pass

            if api_base_url:
                print(f"[Adaptive] 找到 WAF API: {api_base_url}", file=sys.stderr)
                # 解析 base URL 用于拼接
                from urllib.parse import urljoin
                full_api_base = urljoin(url, api_base_url)
                
                # Step 1: GET ?type=get 获取验证码数据
                try:
                    import requests as _req
                    get_resp = _req.get(f"{full_api_base}?type=get", timeout=10)
                    if get_resp.status_code == 200:
                        captcha_data = get_resp.json()
                        if captcha_data.get('code', -1) == 0:
                            captcha_key = captcha_data.get('captcha_key', '')
                            tile_x = captcha_data.get('tile_x', 0)
                            tile_y = captcha_data.get('tile_y', 0)
                            print(f"[Adaptive] 获取验证码数据: key={captcha_key[:20]}..., tile=({tile_x}, {tile_y})", file=sys.stderr)
                            
                            # Step 2: POST ?type=check 提交验证
                            check_resp = _req.post(
                                f"{full_api_base}?type=check",
                                headers={"Content-Type": "application/x-www-form-urlencoded"},
                                data=f"point={tile_x},{tile_y}&key={captcha_key}",
                                timeout=10,
                            )
                            if check_resp.status_code == 200:
                                check_data = check_resp.json()
                                if check_data.get('code', -1) == 0:
                                    print("[Adaptive] WAF 验证成功！等待页面刷新...", file=sys.stderr)
                                    _time.sleep(3)
                                    # 验证成功后页面会 reload，需要重新导航
                                    # 但 scrapling 的 page_action 中无法重新导航
                                    # 改为在 page_action 返回后由调用方重新获取
                                    return
                                else:
                                    print(f"[Adaptive] WAF 验证失败: {check_data}", file=sys.stderr)
                            else:
                                print(f"[Adaptive] WAF check 请求失败: {check_resp.status_code}", file=sys.stderr)
                        else:
                            print(f"[Adaptive] WAF get 数据异常: {captcha_data}", file=sys.stderr)
                    else:
                        print(f"[Adaptive] WAF get 请求失败: {get_resp.status_code}", file=sys.stderr)
                except Exception as e:
                    print(f"[Adaptive] WAF API 验证异常: {e}", file=sys.stderr)

            # ===== 方法2: 尝试拖拽滑块（备用方案） =====
            slider_selectors = [
                '.gc-slide-btn', '.slide-btn', '.slider-btn',
                '[class*="slide-btn"]', '[class*="captcha-btn"]',
            ]
            slider = None
            for sel in slider_selectors:
                slider = page.query_selector(sel)
                if slider:
                    break

            if slider:
                box = slider.bounding_box()
                if box:
                    print(f"[Adaptive] 尝试拖拽滑块验证...", file=sys.stderr)
                    start_x = box['x'] + box['width'] / 2
                    start_y = box['y'] + box['height'] / 2
                    page.mouse.move(start_x, start_y)
                    _time.sleep(0.3)
                    page.mouse.down()
                    _time.sleep(0.1)
                    for i in range(40):
                        import random as _rand
                        progress = (i + 1) / 40
                        ease = 1 - (1 - progress) ** 2
                        current_x = start_x + 300 * ease
                        page.mouse.move(current_x, start_y + _rand.uniform(-2, 2))
                        _time.sleep(_rand.uniform(0.02, 0.06))
                    page.mouse.up()
                    _time.sleep(5)
            else:
                print("[Adaptive] 未找到滑块元素", file=sys.stderr)

        except Exception as e:
            print(f"[Adaptive] WAF 验证处理异常: {e}", file=sys.stderr)

    def _is_empty_page(self, page):
        """检查页面内容是否为空或被拦截"""
        if page is None:
            return True

        # 检查状态码
        try:
            if hasattr(page, 'status') and page.status in (403, 418, 503):
                return True
        except Exception:
            pass

        # 检查页面标题是否为 WAF 验证页
        try:
            title = page.css("title::text").get() or ""
            waf_keywords = ['verification page', 'waf security', 'security check',
                            'captcha', '人机验证', '安全验证']
            title_lower = title.lower()
            if any(kw in title_lower for kw in waf_keywords):
                return True
        except Exception:
            pass

        # 检查页面HTML中的特征
        html_text = ""
        try:
            html_text = page.css("html::text").get() or ""
        except Exception:
            pass

        text = page.css("body::text").get() or ""
        # 常见反爬页面特征
        anti_bot_signs = ["just a moment", "checking your browser", "cloudflare", "access denied",
                          "please verify", "robot check", "captcha", "complete the verification"]
        text_lower = text.lower()
        if any(sign in text_lower for sign in anti_bot_signs) and len(text.strip()) < 500:
            return True

        # SPA空壳页面检测：Nuxt/Next.js等框架的空壳HTML特征
        body_text = text.strip()
        if len(body_text) < 100:
            html_content = html_text.lower() if html_text else ""
            spa_markers = ["__nuxt", "__next", "__app", "id=\"app\"", "id=\"root\""]
            has_spa_marker = any(marker in html_content for marker in spa_markers)
            img_count = len(page.css("img"))
            if has_spa_marker and img_count < 3:
                return True

        return False

    def _get_page_title(self, page):
        """获取页面标题"""
        title = page.css("title::text").get() or ""
        if not title:
            title = page.css("h1::text").get() or ""
        return title.strip()[:100] if title else "未知页面"

    def _extract_img_tags(self, page, base_domain, page_title, count):
        """提取 <img> 标签中的图片"""
        results = []
        img_elements = page.css("img")

        print(f"[Adaptive] 找到 {len(img_elements)} 个 <img> 标签", file=sys.stderr)

        for img in img_elements:
            if len(results) >= count:
                break

            try:
                # 优先 srcset 中的高质量图片
                srcset = img.css("::attr(srcset)").get() or ""
                src = img.css("::attr(src)").get() or ""
                data_src = img.css("::attr(data-src)").get() or ""
                data_srcset = img.css("::attr(data-srcset)").get() or ""

                # 选择最佳URL
                image_url = self._pick_best_image_url(srcset, data_srcset, src, data_src)

                if not image_url:
                    continue

                # 补全相对URL
                image_url = self._normalize_url(image_url, base_domain)

                # 跳过无效URL
                if not self._is_valid_image_url(image_url):
                    continue

                alt = img.css("::attr(alt)").get() or ""
                width_attr = img.css("::attr(width)").get() or ""
                height_attr = img.css("::attr(height)").get() or ""

                # 过滤掉明显太小的图片（图标、logo等）
                try:
                    w = int(width_attr) if width_attr else 0
                    h = int(height_attr) if height_attr else 0
                    if w > 0 and h > 0 and (w < self.min_width or h < self.min_height):
                        continue
                except ValueError:
                    pass

                title = alt.strip() if alt.strip() else f"{page_title} - 图片"
                tags = self._guess_tags(alt, page_title)
                category = self._guess_category(tags)
                # 检测媒体类型
                media_type = self._detect_media_type(image_url) or "image"

                # 检查 data-video/data-mp4 属性（某些网站用img缩略图+data属性存视频URL）
                data_video_url = ""
                if media_type == "image":
                    for attr in ["data-video", "data-mp4", "data-webm", "data-video-url", "data-src-video"]:
                        dv = img.css(f"::attr({attr})").get() or ""
                        if dv and any(ext in dv.lower() for ext in ['.mp4', '.webm', '.mov']):
                            data_video_url = dv
                            media_type = "video"
                            break

                filename = self._url_to_filename(image_url, media_type)

                result = {
                    "title": title[:200],
                    "image_url": image_url,
                    "source_url": base_domain,
                    "source": urlparse(base_domain).netloc.replace("www.", ""),
                    "tags": tags,
                    "category": category,
                    "width": w if 'w' in dir() else 0,
                    "height": h if 'h' in dir() else 0,
                    "filename": filename,
                    "media_type": media_type,
                }
                if media_type == "video":
                    result["video_url"] = data_video_url or image_url
                    result["poster_url"] = "" if not data_video_url else image_url
                    # 如果有 data-video 属性，image_url 作为封面图
                    if data_video_url:
                        result["video_url"] = self._normalize_url(data_video_url, base_domain)
                        # image_url 保持为缩略图/封面图
                results.append(result)

            except Exception as e:
                continue

        return results

    def _extract_css_backgrounds(self, page, base_domain, page_title, count):
        """提取内联样式中的背景图片"""
        results = []
        elements_with_style = page.css("[style*='background']")

        for elem in elements_with_style:
            if len(results) >= count:
                break

            try:
                style = elem.css("::attr(style)").get() or ""
                # 匹配 url(...) 中的图片地址
                bg_urls = re.findall(r'url\(["\']?(.*?)["\']?\)', style)

                for bg_url in bg_urls:
                    if len(results) >= count:
                        break

                    bg_url = self._normalize_url(bg_url, base_domain)
                    if not self._is_valid_image_url(bg_url):
                        continue

                    media_type = self._detect_media_type(bg_url) or "image"
                    filename = self._url_to_filename(bg_url, media_type)
                    tags = self._guess_tags("", page_title)
                    category = self._guess_category(tags)

                    result = {
                        "title": f"{page_title} - 背景图",
                        "image_url": bg_url,
                        "source_url": base_domain,
                        "source": urlparse(base_domain).netloc.replace("www.", ""),
                        "tags": tags,
                        "category": category,
                        "width": 0,
                        "height": 0,
                        "filename": filename,
                        "media_type": media_type,
                    }
                    if media_type == "video":
                        result["poster_url"] = ""
                    results.append(result)
            except Exception:
                continue

        return results

    def _extract_image_links(self, page, base_domain, page_title, count):
        """提取 <a> 标签中直接指向图片/视频的链接"""
        results = []
        links = page.css("a[href]")

        for link in links:
            if len(results) >= count:
                break

            try:
                href = link.css("::attr(href)").get() or ""

                # 使用正则检测媒体类型（支持CDN变体后缀）
                media_type = self._detect_media_type(href)
                if media_type is None:
                    continue

                image_url = self._normalize_url(href, base_domain)
                if not self._is_valid_image_url(image_url):
                    continue

                link_text = link.css("::text").get() or ""
                title = link_text.strip() if link_text.strip() else f"{page_title} - {'动态壁纸' if media_type == 'video' else '图片'}"
                filename = self._url_to_filename(image_url, media_type)
                tags = self._guess_tags(link_text, page_title)
                category = self._guess_category(tags)

                result = {
                    "title": title[:200],
                    "image_url": image_url,
                    "source_url": base_domain,
                    "source": urlparse(base_domain).netloc.replace("www.", ""),
                    "tags": tags,
                    "category": category,
                    "width": 0,
                    "height": 0,
                    "filename": filename,
                    "media_type": media_type,
                }
                if media_type == "video":
                    result["poster_url"] = ""
                results.append(result)
            except Exception:
                continue

        return results

    def _extract_video_tags(self, page, base_domain, page_title, count):
        """提取页面中的动态壁纸视频（<video>/<source>/<a> 视频链接）"""
        results = []
        seen_video_urls = set()

        # 1. 提取 <video> 标签
        video_elements = page.css("video")
        print(f"[Adaptive] 找到 {len(video_elements)} 个 <video> 标签", file=sys.stderr)

        for video in video_elements:
            if len(results) >= count:
                break

            try:
                video_url = ""
                poster_url = ""

                # 获取 poster 属性（封面图）
                poster = video.css("::attr(poster)").get() or ""
                if poster:
                    poster_url = self._normalize_url(poster, base_domain)

                # 获取 <source> 标签
                source_tags = video.css("source")
                for source in source_tags:
                    src = source.css("::attr(src)").get() or ""
                    src_type = source.css("::attr(type)").get() or ""
                    # 优先选择 mp4 格式（兼容性最好）
                    if src:
                        if "mp4" in src_type or not video_url:
                            video_url = src

                # 回退到 video 标签的 src / data-src 属性
                if not video_url:
                    video_url = video.css("::attr(src)").get() or ""
                if not video_url:
                    video_url = video.css("::attr(data-src)").get() or ""

                if not video_url:
                    continue

                video_url = self._normalize_url(video_url, base_domain)

                if video_url in seen_video_urls:
                    continue

                if not self._is_valid_image_url(video_url):
                    continue

                seen_video_urls.add(video_url)

                title_attr = video.css("::attr(title)").get() or ""
                title = title_attr.strip() if title_attr.strip() else f"{page_title} - 动态壁纸"
                filename = self._url_to_filename(video_url, "video")
                tags = self._guess_tags(title_attr, page_title, "动态", "dynamic", "live", "animated")
                category = self._guess_category(tags)

                result = {
                    "title": title[:200],
                    "image_url": poster_url or video_url,
                    "source_url": base_domain,
                    "source": urlparse(base_domain).netloc.replace("www.", ""),
                    "tags": tags,
                    "category": category,
                    "width": 0,
                    "height": 0,
                    "filename": filename,
                    "media_type": "video",
                    "video_url": video_url,
                    "poster_url": poster_url,
                }
                results.append(result)

            except Exception:
                continue

        # 2. 从 <a> 标签中查找指向视频文件的链接（补充漏网之鱼）
        if len(results) < count:
            links = page.css("a[href]")
            for link in links:
                if len(results) >= count:
                    break
                try:
                    href = link.css("::attr(href)").get() or ""
                    if not href:
                        continue
                    media_type = self._detect_media_type(href)
                    if media_type != "video":
                        continue
                    video_url = self._normalize_url(href, base_domain)
                    if video_url in seen_video_urls:
                        continue
                    if not self._is_valid_image_url(video_url):
                        continue
                    seen_video_urls.add(video_url)

                    link_text = link.css("::text").get() or ""
                    title = link_text.strip() if link_text.strip() else f"{page_title} - 动态壁纸"
                    filename = self._url_to_filename(video_url, "video")
                    tags = self._guess_tags(link_text, page_title, "动态", "dynamic", "live", "animated")
                    category = self._guess_category(tags)

                    result = {
                        "title": title[:200],
                        "image_url": video_url,
                        "source_url": base_domain,
                        "source": urlparse(base_domain).netloc.replace("www.", ""),
                        "tags": tags,
                        "category": category,
                        "width": 0,
                        "height": 0,
                        "filename": filename,
                        "media_type": "video",
                        "video_url": video_url,
                        "poster_url": "",
                    }
                    results.append(result)
                except Exception:
                    continue

        return results

    def _extract_script_videos(self, page, base_domain, page_title, count):
        """从页面脚本/内嵌JSON中提取视频URL（适用于JS动态加载的壁纸站）"""
        results = []
        seen_video_urls = set()
        # 收集已提取过的视频URL，避免重复
        # 这个方法在 _extract_video_tags 之后调用，所以需要更全面的去重

        # 查找页面中所有 <script> 标签的内容
        script_tags = page.css("script")
        for script in script_tags:
            if len(results) >= count:
                break
            try:
                script_text = script.css("::text").get() or ""
                if not script_text:
                    continue

                # 使用正则从JS代码中提取视频URL
                # 匹配 "xxx.mp4", 'xxx.webm', url: "xxx.mp4" 等模式
                video_patterns = [
                    r'["\']([^"\'\s]+?\.(?:mp4|webm|mov|avi|mkv)(?:\?[^"\'\s]*?)?)["\'\s]',
                    r'src\s*[:=]\s*["\'\s]([^"\'\s]+?\.(?:mp4|webm|mov)(?:\?[^"\'\s]*?)?)["\'\s]',
                    r'video[_-]?url\s*[:=]\s*["\']([^"\'\s]+?)["\'\s]',
                    r'file\s*[:=]\s*["\']([^"\'\s]+?\.(?:mp4|webm|mov)(?:\?[^"\'\s]*?)?)["\'\s]',
                ]
                for pattern in video_patterns:
                    matches = re.findall(pattern, script_text, re.IGNORECASE)
                    for match in matches:
                        if len(results) >= count:
                            break
                        video_url = match
                        # 过滤掉明显非URL的字符串
                        if not video_url or video_url.startswith("//"):
                            if video_url.startswith("//"):
                                video_url = "https:" + video_url
                            else:
                                continue
                        if not video_url.startswith(("http://", "https://")):
                            video_url = self._normalize_url(video_url, base_domain)
                        if video_url in seen_video_urls:
                            continue
                        if not self._is_valid_image_url(video_url):
                            continue
                        seen_video_urls.add(video_url)

                        filename = self._url_to_filename(video_url, "video")
                        tags = self._guess_tags(page_title, "动态", "dynamic", "animated")
                        category = self._guess_category(tags)

                        result = {
                            "title": f"{page_title} - 动态壁纸",
                            "image_url": video_url,
                            "source_url": base_domain,
                            "source": urlparse(base_domain).netloc.replace("www.", ""),
                            "tags": tags,
                            "category": category,
                            "width": 0,
                            "height": 0,
                            "filename": filename,
                            "media_type": "video",
                            "video_url": video_url,
                            "poster_url": "",
                        }
                        results.append(result)
            except Exception:
                continue

        if results:
            print(f"[Adaptive] 从脚本中提取到 {len(results)} 个视频URL", file=sys.stderr)

        return results

    def _pick_best_image_url(self, srcset, data_srcset, src, data_src):
        """从多个图片属性中选择最高质量的URL"""
        # 优先从 srcset/data-srcset 中选择高质量图片
        for ss in [srcset, data_srcset]:
            if not ss:
                continue
            candidates = []
            for part in ss.split(","):
                part = part.strip()
                if not part:
                    continue
                segments = part.split()
                if segments:
                    url = segments[0]
                    # 优先选择较大尺寸
                    if len(segments) > 1 and "w" in segments[1]:
                        try:
                            width = int(segments[1].replace("w", ""))
                            if width >= 1920:
                                return url
                        except ValueError:
                            pass
                    candidates.append(url)
            if candidates:
                # 返回最后一个（通常是最大的）
                return candidates[-1]

        # 回退到 src 或 data-src
        return src or data_src

    def _normalize_url(self, url, base_domain):
        """将相对URL转为绝对URL"""
        if not url:
            return ""
        url = url.strip()
        # 跳过 data: URL（base64内嵌图片，不需要转换）
        if url.startswith("data:"):
            return ""
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            return base_domain + url
        if not url.startswith(("http://", "https://")):
            return base_domain + "/" + url
        return url

    def _is_valid_media_url(self, url):
        """检查是否是有效的图片/视频URL"""
        if not url or not url.startswith(("http://", "https://")):
            return False
        # 跳过 data: URL
        if url.startswith("data:"):
            return False
        # 跳过明显非媒体文件的URL
        parsed = urlparse(url)
        path_lower = parsed.path.lower()
        skip_exts = ['.css', '.js', '.woff', '.ico', '.svg', '.pdf']
        if any(path_lower.endswith(ext) for ext in skip_exts):
            return False
        # 跳过小图标/头像类URL
        skip_patterns = ['avatar', 'favicon', 'logo', 'icon', 'badge', 'emoji', 'spinner', 'loading']
        if any(p in url.lower() for p in skip_patterns):
            return False
        # 跳过1x1像素跟踪图片
        if '1x1' in url or 'pixel' in url.lower():
            return False
        return True

    def _detect_media_type(self, url):
        """检测URL的媒体类型: 'image', 'video', 或 None(非媒体)"""
        if not url:
            return None
        # 去掉查询参数后检查路径
        path = urlparse(url).path
        # 检查视频后缀
        if self.VIDEO_EXT_PATTERN.search(path):
            return "video"
        # 检查图片后缀（含CDN变体）
        if self.IMAGE_EXT_PATTERN.search(path):
            return "image"
        # URL中没有明确后缀时，检查查询参数中的提示
        url_lower = url.lower()
        if any(ext in url_lower for ext in ['.mp4', '.webm', '.mov', '.avi']):
            return "video"
        if any(ext in url_lower for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']):
            return "image"
        return None

    # 保留旧方法名的兼容别名
    def _is_valid_image_url(self, url):
        """检查是否是有效的图片/视频URL（兼容旧调用）"""
        return self._is_valid_media_url(url)

    def _url_to_filename(self, url, media_type="image"):
        """从URL生成文件名（支持CDN变体后缀）"""
        parsed = urlparse(url)
        # 去掉查询参数
        path = parsed.path.split("?")[0]
        filename = os.path.basename(path)

        if not filename or '.' not in filename:
            # URL中没有文件名，用hash生成
            ext = ".mp4" if media_type == "video" else ".jpg"
            filename = f"img_{hashlib.md5(url.encode()).hexdigest()[:12]}{ext}"
        else:
            # 处理CDN变体后缀: .jpg-pcthumbs -> .jpg, .jpeg_webp -> .jpeg
            m = self.IMAGE_EXT_PATTERN.search(filename) if media_type == "image" else None
            vm = self.VIDEO_EXT_PATTERN.search(filename) if media_type == "video" else None
            if m:
                base = filename[:m.start()] + "." + m.group(1)
                # .jpeg -> .jpg 统一
                if base.endswith(".jpeg"):
                    base = base[:-5] + ".jpg"
                filename = base
            elif vm:
                filename = filename[:vm.start()] + "." + vm.group(1)
            elif media_type == "video" and not any(filename.endswith(e) for e in ['.mp4', '.webm', '.mov', '.avi', '.mkv']):
                # 没有视频扩展名时补上
                name_part = os.path.splitext(filename)[0]
                filename = f"{name_part}.mp4"

        # 清理文件名
        filename = re.sub(r'[^\w.\-]', '_', filename)
        if len(filename) > 100:
            name, ext = os.path.splitext(filename)
            filename = name[:90] + ext
        return filename

    def _guess_tags(self, *texts):
        """从文本中猜测标签"""
        tags = []
        combined = " ".join(texts).lower()
        for kw, label in CATEGORY_MAP.items():
            if kw in combined and label not in tags:
                tags.append(label)
        if not tags:
            tags = ["壁纸", "爬取"]
        return tags[:5]

    def _guess_category(self, tags):
        """根据标签猜测分类"""
        for tag in tags:
            for kw, label in CATEGORY_MAP.items():
                if kw in tag.lower() or label in tag:
                    return label
        return "未分类"


# ============================================================
# Wallhaven 爬取器（保留固定源模式）
# ============================================================

class WallhavenCrawler:
    """Wallhaven 壁纸爬取器"""

    BASE_URL = "https://wallhaven.cc"
    SEARCH_URL = "https://wallhaven.cc/search"

    def crawl(self, mode="random", count=10):
        results = []
        try:
            # categories: 1=General, 1=Anime, 1=People; purity: 1=SFW, 0=Sketchy, 0=NSFW
            # 包含动态壁纸（category flag 10 = Animations）
            if mode == "random":
                url = f"{self.SEARCH_URL}?categories=111&purity=100&sorting=random&per_page={min(count, 24)}"
            elif mode == "anime":
                url = f"{self.SEARCH_URL}?categories=010&purity=100&sorting=random&per_page={min(count, 24)}"
            else:
                url = f"{self.SEARCH_URL}?categories=111&purity=100&sorting=date_added&per_page={min(count, 24)}"

            print(f"[Wallhaven] 正在访问: {url}", file=sys.stderr)
            page = StealthyFetcher.fetch(url, headless=True, timeout=30000, network_idle=True, wait=2000)

            thumb_links = page.css("a.preview::attr(href)").getall()
            if not thumb_links:
                items = page.css("figure.thumb a")
                thumb_links = []
                for item in items:
                    href = item.css("::attr(href)").get()
                    if href:
                        thumb_links.append(href)

            print(f"[Wallhaven] 找到 {len(thumb_links)} 个壁纸链接", file=sys.stderr)

            for i, detail_url in enumerate(thumb_links[:count]):
                try:
                    print(f"[Wallhaven] 正在处理 {i+1}/{min(len(thumb_links), count)}: {detail_url}", file=sys.stderr)
                    detail_page = StealthyFetcher.fetch(detail_url, headless=True, timeout=30000, network_idle=True, wait=1500)

                    # 先尝试提取静态图片
                    image_url = detail_page.css("#wallpaper::attr(src)").get()
                    if not image_url:
                        image_url = detail_page.css("img.wallpaper::attr(src)").get()
                    if not image_url:
                        img_tags = detail_page.css("img[src*='wallhaven']")
                        for img in img_tags:
                            src = img.css("::attr(src)").get()
                            if src and ("full" in src or "wallhaven" in src):
                                image_url = src
                                break

                    # 动态壁纸：提取 <video> 标签中的视频URL
                    video_url = ""
                    poster_url = ""
                    video_element = detail_page.css("#wallpaper")
                    if video_element:
                        # 检查 #wallpaper 是否为 <video> 标签
                        vid_src = video_element[0].css("::attr(src)").get() or ""
                        if vid_src and any(ext in vid_src.lower() for ext in ['.mp4', '.webm', '.mov']):
                            video_url = vid_src
                            poster_url = video_element[0].css("::attr(poster)").get() or ""
                            image_url = vid_src  # 用视频URL作为主URL

                    # 备选：查找 <video> 标签
                    if not video_url:
                        video_tags = detail_page.css("video")
                        for vt in video_tags:
                            # 检查 <source> 子标签
                            source_tags = vt.css("source")
                            for st in source_tags:
                                s_src = st.css("::attr(src)").get() or ""
                                s_type = st.css("::attr(type)").get() or ""
                                if s_src and ("mp4" in s_type or "video" in s_type or not video_url):
                                    video_url = s_src
                            if not video_url:
                                v_src = vt.css("::attr(src)").get() or ""
                                if v_src:
                                    video_url = v_src
                            if video_url:
                                poster_url = vt.css("::attr(poster)").get() or ""
                                break

                    # 如果找到了视频但没找到图片，用视频URL
                    if video_url and not image_url:
                        image_url = video_url

                    if not image_url:
                        continue

                    title = detail_page.css("h1::text").get() or detail_page.css("#wallpaper-title::text").get() or "Wallhaven Wallpaper"
                    tags = [t.strip() for t in detail_page.css("#tags .tagname::text").getall() if t.strip()]
                    if not tags:
                        tags = [t.strip() for t in detail_page.css(".tag-name::text").getall() if t.strip()]

                    resolution = detail_page.css(".wall-res::text").get() or ""
                    width, height = 0, 0
                    if "x" in resolution:
                        parts = resolution.strip().split("x")
                        if len(parts) == 2:
                            try:
                                width = int(parts[0].strip())
                                height = int(parts[1].strip())
                            except ValueError:
                                pass

                    category = self._guess_category(tags)
                    filename = image_url.split("/")[-1].split("?")[0] or f"wallhaven_{int(time.time())}.jpg"

                    # 检测是否为动态壁纸
                    wh_media_type = "video" if video_url else (
                        "video" if image_url and any(
                            ext in image_url.lower() for ext in ['.mp4', '.webm', '.mov']
                        ) else "image"
                    )

                    result_item = {
                        "title": title.strip() if title else filename,
                        "image_url": image_url,
                        "source_url": detail_url,
                        "source": "wallhaven",
                        "tags": tags[:10],
                        "category": category,
                        "width": width,
                        "height": height,
                        "filename": filename,
                        "media_type": wh_media_type,
                    }
                    if wh_media_type == "video":
                        result_item["video_url"] = video_url or image_url
                        result_item["poster_url"] = poster_url or ""
                        # image_url 改为封面图（如果有）
                        if poster_url:
                            result_item["image_url"] = poster_url
                    results.append(result_item)

                    time.sleep(random.uniform(1.0, 2.5))

                except Exception as e:
                    print(f"[Wallhaven] 处理详情页出错: {e}", file=sys.stderr)
                    continue

        except Exception as e:
            print(f"[Wallhaven] 爬取出错: {e}", file=sys.stderr)

        return results

    def _guess_category(self, tags):
        for tag in tags:
            if tag.lower() in CATEGORY_MAP:
                return CATEGORY_MAP[tag.lower()]
        return "未分类"


# ============================================================
# 图片下载器
# ============================================================

def download_image(url, download_dir=None, timeout=30):
    """下载图片到本地，返回文件路径"""
    if not download_dir:
        download_dir = tempfile.mkdtemp(prefix="crawl_")

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "/",
        }
        response = requests.get(url, headers=headers, timeout=timeout, stream=True)
        response.raise_for_status()

        content_type = response.headers.get("content-type", "image/jpeg")
        ext = "jpg"
        if "png" in content_type:
            ext = "png"
        elif "webp" in content_type:
            ext = "webp"

        filename_hash = hashlib.md5(url.encode()).hexdigest()[:12]
        filename = f"crawled_{filename_hash}.{ext}"
        filepath = os.path.join(download_dir, filename)

        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return filepath

    except Exception as e:
        print(f"[下载] 下载图片失败 {url}: {e}", file=sys.stderr)
        return None


# ============================================================
# 主函数
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="壁纸爬虫 - 基于 Scrapling 自适应爬虫")

    # 互斥模式：--url 或 --source 二选一
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--url", type=str, help="自定义爬取URL（自适应模式，输入任意网页地址）")
    mode_group.add_argument("--source", type=str, choices=list(CRAWL_SOURCES.keys()), help="固定爬取源")

    parser.add_argument("--fetch-mode", type=str, default="auto",
                        choices=["auto", "static", "stealthy"],
                        help="爬取方式: auto(自动选择)/static(静态HTTP)/stealthy(隐身浏览器)")
    parser.add_argument("--count", type=int, default=10, help="爬取数量 (默认: 10)")
    parser.add_argument("--min-width", type=int, default=800, help="最小图片宽度过滤 (默认: 800)")
    parser.add_argument("--min-height", type=int, default=600, help="最小图片高度过滤 (默认: 600)")
    parser.add_argument("--output", type=str, default=None, help="输出JSON文件路径 (默认输出到stdout)")
    parser.add_argument("--download", action="store_true", help="是否下载图片到本地临时目录")
    parser.add_argument("--download-dir", type=str, default=None, help="下载图片的目录")

    args = parser.parse_args()

    if args.url:
        # ===== 自定义URL模式 =====
        print(f"模式: 自适应爬取", file=sys.stderr)
        print(f"目标URL: {args.url}", file=sys.stderr)
        print(f"爬取方式: {args.fetch_mode}", file=sys.stderr)
        print(f"数量: {args.count}", file=sys.stderr)

        crawler = AdaptiveCrawler(
            min_width=args.min_width,
            min_height=args.min_height,
            max_images=args.count,
        )
        results = crawler.crawl(url=args.url, mode=args.fetch_mode, count=args.count)

    else:
        # ===== 固定源模式 =====
        source_info = CRAWL_SOURCES[args.source]
        print(f"爬取源: {source_info['name']} - {source_info['description']}", file=sys.stderr)
        print(f"数量: {args.count}", file=sys.stderr)

        crawlers = {
            "wallhaven": WallhavenCrawler,
        }

        crawler_class = crawlers.get(args.source)
        if crawler_class:
            crawler = crawler_class()
            results = crawler.crawl(mode="random", count=args.count)
        else:
            # 其他固定源使用自适应爬取器
            print(f"[{args.source}] 使用自适应爬取器...", file=sys.stderr)
            crawler = AdaptiveCrawler(min_width=args.min_width, min_height=args.min_height)
            results = crawler.crawl(url=source_info["url"], mode="auto", count=args.count)
            # 补充 source 字段
            for r in results:
                r["source"] = args.source

    # 下载图片（如果指定）
    if args.download and results:
        download_dir = args.download_dir or tempfile.mkdtemp(prefix="crawl_")
        print(f"下载目录: {download_dir}", file=sys.stderr)

        for i, item in enumerate(results):
            print(f"下载 {i+1}/{len(results)}: {item.get('filename', 'unknown')}", file=sys.stderr)
            filepath = download_image(item["image_url"], download_dir)
            if filepath:
                item["local_path"] = filepath
                item["file_size"] = os.path.getsize(filepath)
            time.sleep(random.uniform(0.5, 1.5))

    # 输出结果
    output = {
        "success": True,
        "source": args.url if args.url else args.source,
        "mode": args.fetch_mode if args.url else "random",
        "count": len(results),
        "results": results,
    }

    output_json = json.dumps(output, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"结果已保存到: {args.output}", file=sys.stderr)
    else:
        # 输出到 stdout（便于 Node.js 子进程调用）
        print(output_json)


if __name__ == "__main__":
    main()