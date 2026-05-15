#!/usr/bin/env python3
"""测试wallhaven视频页面爬取"""
import sys
sys.path.insert(0, '.')
from crawl_with_scrapling import AdaptiveCrawler

# Wallhaven动态壁纸详情页示例
crawler = AdaptiveCrawler()

# 测试wallhaven搜索页
test_url = "https://wallhaven.cc/search?categories=111&purity=100&sorting=random&per_page=5"
print(f"测试URL: {test_url}")
results = crawler.crawl(url=test_url, mode="static", count=5)
print(f"\n获取到 {len(results)} 个结果")
for r in results:
    print(f"- {r.get('title', 'N/A')[:50]}")
    print(f"  media_type: {r.get('media_type', 'N/A')}")
    print(f"  image_url: {r.get('image_url', 'N/A')[:80]}")
    if r.get('video_url'):
        print(f"  video_url: {r['video_url'][:80]}")
    print()