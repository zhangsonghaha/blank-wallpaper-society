#!/usr/bin/env python3
"""增强自定义URL爬取动态壁纸支持：
1. crawl() 策略4提升为始终执行（而非只在图片不够时补充）
2. 去重逻辑支持 video_url
3. _extract_img_tags 检查 data-video/data-mp4 属性，video类型设置 video_url
4. _extract_video_tags 增加 iframe/embed 和 JS 变量中的视频URL提取
"""

import os

filepath = os.path.join(os.path.dirname(__file__), 'crawl_with_scrapling.py')

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# ===== 1. 修改 crawl() 去重逻辑和策略4执行顺序 =====
old_crawl = '''            # 策略4: 提取 <video> 标签中的动态壁纸
            video_results = self._extract_video_tags(page, base_domain, page_title, count)
            results.extend(video_results)

            # 去重
            seen_urls = set()
            unique_results = []
            for item in results:
                if item["image_url"] not in seen_urls:
                    seen_urls.add(item["image_url"])
                    unique_results.append(item)'''

new_crawl = '''            # 策略4: 提取 <video> 标签中的动态壁纸（始终执行，不只补充）
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
                    unique_results.append(item)'''

if old_crawl in content:
    content = content.replace(old_crawl, new_crawl)
    changes += 1
    print("[OK] 修改 crawl() 去重和策略4")
else:
    print("[SKIP] crawl() - 未找到匹配文本")

# ===== 2. 修改 _extract_img_tags: video类型设置 video_url，检查 data-video/data-mp4 =====
old_img_video = '''                # 检测媒体类型
                media_type = self._detect_media_type(image_url) or "image"
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
                    result["poster_url"] = ""
                results.append(result)'''

new_img_video = '''                # 检测媒体类型
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
                results.append(result)'''

if old_img_video in content:
    content = content.replace(old_img_video, new_img_video)
    changes += 1
    print("[OK] 修改 _extract_img_tags video 支持")
else:
    print("[SKIP] _extract_img_tags - 未找到匹配文本")

# ===== 3. 在 _pick_best_image_url 之前插入 _extract_script_videos =====
old_pick = '    def _pick_best_image_url(self, srcset, data_srcset, src, data_src):'

new_script = '''    def _extract_script_videos(self, page, base_domain, page_title, count):
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
                    r'["\\']([^"\\'\\s]+?\\.(?:mp4|webm|mov|avi|mkv)(?:\\?[^"\\'\\s]*?)?)["\\'\\s]',
                    r'src\\s*[:=]\\s*["\\'\\s]([^"\\'\\s]+?\\.(?:mp4|webm|mov)(?:\\?[^"\\'\\s]*?)?)["\\'\\s]',
                    r'video[_-]?url\\s*[:=]\\s*["\\']([^"\\'\\s]+?)["\\'\\s]',
                    r'file\\s*[:=]\\s*["\\']([^"\\'\\s]+?\\.(?:mp4|webm|mov)(?:\\?[^"\\'\\s]*?)?)["\\'\\s]',
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

    def _pick_best_image_url(self, srcset, data_srcset, src, data_src):'''

if old_pick in content:
    content = content.replace(old_pick, new_script, 1)
    changes += 1
    print("[OK] 添加 _extract_script_videos 方法")
else:
    print("[SKIP] _extract_script_videos - 未找到匹配文本")

# 写回文件
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nApplied {changes} changes successfully!")
print(f"Total lines: {len(content.splitlines())}")