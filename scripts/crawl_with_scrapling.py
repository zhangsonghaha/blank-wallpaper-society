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

    # 常见非图片URL后缀（跳过）
    SKIP_EXTENSIONS = {
        '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.ico',
        '.svg', '.gif', '.mp4', '.mp3', '.avi', '.mov', '.webm',
        '.pdf', '.zip', '.rar', '.doc', '.docx', '.xls', '.xlsx',
    }

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

            # 去重
            seen_urls = set()
            unique_results = []
            for item in results:
                if item["image_url"] not in seen_urls:
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
            # auto 模式：先尝试静态，失败则回退到隐身
            page = self._fetch_static(url)
            if page is None or self._is_empty_page(page):
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
        """使用隐身浏览器获取页面（可绕过反爬）"""
        try:
            print(f"[Adaptive] 使用隐身浏览器获取: {url}", file=sys.stderr)
            page = StealthyFetcher.fetch(url, headless=True, timeout=60)
            print(f"[Adaptive] 隐身浏览器获取成功，状态码: {page.status}", file=sys.stderr)
            return page
        except Exception as e:
            print(f"[Adaptive] 隐身浏览器获取失败: {e}", file=sys.stderr)
            return None

    def _is_empty_page(self, page):
        """检查页面内容是否为空或被拦截"""
        if page is None:
            return True
        text = page.css("body::text").get() or ""
        # 常见反爬页面特征
        anti_bot_signs = ["just a moment", "checking your browser", "cloudflare", "access denied"]
        text_lower = text.lower()
        return any(sign in text_lower for sign in anti_bot_signs) and len(text.strip()) < 500

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
                filename = self._url_to_filename(image_url)

                results.append({
                    "title": title[:200],
                    "image_url": image_url,
                    "source_url": base_domain,
                    "source": urlparse(base_domain).netloc.replace("www.", ""),
                    "tags": tags,
                    "category": category,
                    "width": w if 'w' in dir() else 0,
                    "height": h if 'h' in dir() else 0,
                    "filename": filename,
                })

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

                    filename = self._url_to_filename(bg_url)
                    tags = self._guess_tags("", page_title)
                    category = self._guess_category(tags)

                    results.append({
                        "title": f"{page_title} - 背景图",
                        "image_url": bg_url,
                        "source_url": base_domain,
                        "source": urlparse(base_domain).netloc.replace("www.", ""),
                        "tags": tags,
                        "category": category,
                        "width": 0,
                        "height": 0,
                        "filename": filename,
                    })
            except Exception:
                continue

        return results

    def _extract_image_links(self, page, base_domain, page_title, count):
        """提取 <a> 标签中直接指向图片的链接"""
        results = []
        image_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
        links = page.css("a[href]")

        for link in links:
            if len(results) >= count:
                break

            try:
                href = link.css("::attr(href)").get() or ""
                href_lower = href.lower()

                # 检查是否指向图片文件
                if not any(href_lower.endswith(ext) for ext in image_extensions):
                    continue

                image_url = self._normalize_url(href, base_domain)
                if not self._is_valid_image_url(image_url):
                    continue

                link_text = link.css("::text").get() or ""
                title = link_text.strip() if link_text.strip() else f"{page_title} - 图片"
                filename = self._url_to_filename(image_url)
                tags = self._guess_tags(link_text, page_title)
                category = self._guess_category(tags)

                results.append({
                    "title": title[:200],
                    "image_url": image_url,
                    "source_url": base_domain,
                    "source": urlparse(base_domain).netloc.replace("www.", ""),
                    "tags": tags,
                    "category": category,
                    "width": 0,
                    "height": 0,
                    "filename": filename,
                })
            except Exception:
                continue

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
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            return base_domain + url
        if not url.startswith(("http://", "https://")):
            return base_domain + "/" + url
        return url

    def _is_valid_image_url(self, url):
        """检查是否是有效的图片URL"""
        if not url or not url.startswith(("http://", "https://")):
            return False
        # 跳过 data: URL
        if url.startswith("data:"):
            return False
        # 跳过明显非图片的URL
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

    def _url_to_filename(self, url):
        """从URL生成文件名"""
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path).split("?")[0]
        if not filename or '.' not in filename:
            filename = f"img_{hashlib.md5(url.encode()).hexdigest()[:12]}.jpg"
        # 清理文件名
        filename = re.sub(r'[^\w\.\-]', '_', filename)
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
            if mode == "random":
                url = f"{self.SEARCH_URL}?categories=111&purity=100&sorting=random&per_page={min(count, 24)}"
            else:
                url = f"{self.SEARCH_URL}?categories=111&purity=100&sorting=date_added&per_page={min(count, 24)}"

            print(f"[Wallhaven] 正在访问: {url}", file=sys.stderr)
            page = StealthyFetcher.fetch(url, headless=True, timeout=30)

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
                    detail_page = StealthyFetcher.fetch(detail_url, headless=True, timeout=20)

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

                    results.append({
                        "title": title.strip() if title else filename,
                        "image_url": image_url,
                        "source_url": detail_url,
                        "source": "wallhaven",
                        "tags": tags[:10],
                        "category": category,
                        "width": width,
                        "height": height,
                        "filename": filename,
                    })

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