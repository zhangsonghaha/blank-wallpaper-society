#!/usr/bin/env python3
"""Analyze HAR file for getCompleteUrl request"""
import json

with open('scripts/haowallpaper_download.har', encoding='utf-8') as f:
    har = json.load(f)

entries = har['log']['entries']
getComplete = [e for e in entries if 'getCompleteUrl' in e['request']['url']]
print(f"{len(getComplete)} getCompleteUrl entries found")

for e in getComplete[:2]:
    print("\n=== Request ===")
    print(f"URL: {e['request']['url']}")
    print(f"Method: {e['request']['method']}")
    print("Headers:")
    for h in e['request']['headers']:
        if h['name'].lower() not in ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'accept-encoding', 'accept-language', 'connection']:
            print(f"  {h['name']}: {h['value']}")
    
    print("\n=== Response ===")
    print(f"Status: {e['response']['status']}")
    print(f"Content: {e['response']['content'].get('text', '')[:500]}")