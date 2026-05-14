#!/usr/bin/env python3
"""测试哲风壁纸动态壁纸 - 静态抓取"""
import re, requests

# 先试列表页
list_url = 'https://haowallpaper.com/mobileView?page=1&typeId=35c203f75643ac7803b8f706fa91ef40&sortType=3&rows=13&wpType=5,6'
print(f"=== 列表页 ===")
r = requests.get(list_url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
html = r.text

# 找详情页链接
detail_links = re.findall(r'href="(/mobileViewLook/\d+)"', html)
print(f"详情页链接: {len(detail_links)}")
for l in detail_links[:3]:
    print(f"  {l}")

# 找图片URL
img_urls = re.findall(r'https?://haowallpaper\.com/link/common/file/[^\s"\'<>]+', html)
print(f"\n图片URL: {len(img_urls)}")
for u in set(img_urls[:5]):
    print(f"  {u}")

# 找视频关键词
for pattern in [r'video[Uu]rl["\s:=]+["\']([^"\']+)["\']', r'getVideo', r'\.mp4', r'\.webm',
                r'wpType', r'动态', r'animated', r'live']:
    matches = re.findall(pattern, html, re.IGNORECASE)
    if matches:
        print(f"\n  {pattern}: {len(matches)} matches")
        for m in matches[:3]:
            print(f"    {m}")

# 试API
print("\n=== 试试常见API ===")
# 哲风壁纸的API可能是什么格式
api_urls = [
    'https://haowallpaper.com/link/common/file/getVideo/18069653525613952',
    'https://haowallpaper.com/api/wallpaper/detail?id=18069653525613952',
]
for api_url in api_urls:
    try:
        resp = requests.get(api_url, timeout=10, headers={'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://haowallpaper.com/'})
        print(f"  {api_url} -> {resp.status_code} {resp.headers.get('content-type','')[:50]}")
        if resp.status_code == 200 and 'json' in resp.headers.get('content-type',''):
            import json
            data = resp.json()
            print(f"  JSON keys: {list(data.keys())[:10]}")
            print(f"  Data: {json.dumps(data, ensure_ascii=False)[:300]}")
    except Exception as e:
        print(f"  {api_url} -> ERROR: {e}")