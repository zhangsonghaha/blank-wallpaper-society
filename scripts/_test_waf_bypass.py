"""测试使用浏览器交互完成 WAF 验证
思路：使用 page_action 在浏览器中直接执行 JS 来获取验证码数据并提交
"""
import time
import json
from scrapling.fetchers import StealthyFetcher

def solve_waf_in_browser(page):
    """在浏览器中执行 JS 完成 WAF 验证"""
    time.sleep(3)
    
    # 检查是否是 WAF 验证页面
    title = page.evaluate("document.title")
    print(f"Page title: {title}")
    
    if 'verification' not in title.lower() and 'waf' not in title.lower():
        print("Not a WAF page, skipping")
        return
    
    # 在浏览器中获取 go-captcha 实例和 API
    api_base = page.evaluate("""
        (() => {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const text = s.textContent || '';
                const m = text.match(/API_BASE_URL\\s*=\\s*['"]([^'"]+)['"]/);
                if (m) return m[1];
            }
            return '';
        })()
    """)
    print(f"API_BASE_URL: {api_base}")
    
    if not api_base:
        print("No API_BASE_URL found")
        return
    
    # 直接用浏览器内 fetch 完成验证
    result = page.evaluate("""
        async (apiBase) => {
            try {
                // Step 1: Get captcha data
                const getResp = await fetch(apiBase + '?type=get');
                const getData = await getResp.json();
                if (getData.code !== 0) return {error: 'get failed', data: getData};
                
                const key = getData.captcha_key || '';
                const tileX = getData.tile_x || 0;
                const tileY = getData.tile_y || 0;
                
                // 打印完整数据来分析
                const allKeys = Object.keys(getData);
                
                return {
                    key: key,
                    tileX: tileX,
                    tileY: tileY,
                    allKeys: allKeys,
                    fullData: JSON.stringify(getData).substring(0, 500)
                };
            } catch(e) {
                return {error: e.message};
            }
        }
    """, api_base)
    
    print(f"Captcha data: {json.dumps(result, indent=2)}")
    
    # 看看完整返回了哪些字段
    if result.get('allKeys'):
        print(f"All API keys: {result['allKeys']}")
    if result.get('fullData'):
        print(f"Full data: {result['fullData']}")

# 测试
page = StealthyFetcher.fetch(
    'https://haowallpaper.com/',
    headless=True,
    timeout=60000,
    network_idle=True,
    wait=3000,
    page_action=solve_waf_in_browser,
)

print(f"\nFinal status={page.status}")
title = page.css("title::text").get()
print(f"Final title={title}")