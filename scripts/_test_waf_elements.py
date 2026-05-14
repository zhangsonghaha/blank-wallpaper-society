"""获取完整的 WAF 验证 JS 代码"""
from scrapling.fetchers import StealthyFetcher

page = StealthyFetcher.fetch(
    'https://haowallpaper.com/',
    headless=True,
    timeout=60000,
    network_idle=True,
    wait=3000,
)

scripts = page.css("script")
for i, s in enumerate(scripts):
    text = s.css("::text").get() or ""
    if text and len(text) > 100:
        with open("scripts/test_waf_js.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Saved JS ({len(text)} chars) to scripts/test_waf_js.txt")
        break