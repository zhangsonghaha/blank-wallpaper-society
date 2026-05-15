#!/usr/bin/env python3
"""测试视频URL检测逻辑"""
import sys
sys.path.insert(0, '.')
from crawl_with_scrapling import AdaptiveCrawler

test_urls = [
    # 视频URL
    'https://example.com/video.mp4',
    'https://example.com/video.mp4?param=1',
    'https://example.com/anim.webm',
    'https://th.wallhaven.cc/small/1p/1p1234.jpg',  # 缩略图
    'https://w.wallhaven.cc/full/x8/wallhaven-x8v95g.mp4',  # wallhaven视频
    # 图片URL
    'https://example.com/image.jpg',
    'https://example.com/image.png',
    'https://example.com/image.webp',
]

crawler = AdaptiveCrawler()
for url in test_urls:
    media_type = crawler._detect_media_type(url)
    print(f'{url} -> {media_type}')

# 测试正则表达式
print("\n--- 视频正则测试 ---")
for url in test_urls:
    match = crawler.VIDEO_EXT_PATTERN.search(url)
    print(f'{url} -> match={bool(match)}')

print("\n--- 图片正则测试 ---")
for url in test_urls:
    match = crawler.IMAGE_EXT_PATTERN.search(url)
    print(f'{url} -> match={bool(match)}')