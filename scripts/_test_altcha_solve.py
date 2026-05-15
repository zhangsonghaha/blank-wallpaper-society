#!/usr/bin/env python3
"""Debug HTTP 305 from getCompleteUrl"""
import requests, json, time, base64
from urllib.parse import unquote
from altcha import solve_challenge_v1, ChallengeV1

BASE_URL = "https://haowallpaper.com"
WT_ID = "17603706209226112"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/",
})

# Visit detail page
r = session.get(f"{BASE_URL}/homeViewLook/{WT_ID}")
token = unquote(session.cookies.get("askId", ""))
print(f"Token: {token}")

# Solve Altcha
r = session.get(f"{BASE_URL}/link/pc/certify/challenge", headers={"Accept": "application/json"})
data = r.json()
challenge = ChallengeV1(algorithm=data["algorithm"], challenge=data["challenge"],
                        max_number=data.get("maxnumber", 1000000), salt=data["salt"], signature=data["signature"])
solution = solve_challenge_v1(challenge)
payload = {"algorithm": data["algorithm"], "challenge": data["challenge"], "number": solution.number, "salt": data["salt"], "signature": data["signature"]}
payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
r = session.post(f"{BASE_URL}/link/pc/certify/verify", headers={"Content-Type": "application/json", "Accept": "application/json"}, data=json.dumps({"payload": payload_b64}))
print(f"Verify: {r.text[:200]}")

# Try getCompleteUrl with different approaches
url = f"{BASE_URL}/link/common/file/getCompleteUrl/{WT_ID}"

# 1. Without allow_redirects
print("\n=== Without redirects ===")
r = session.get(url, headers={"Accept": "application/json", "Cache-Control": "no-cache", "token": token}, allow_redirects=False)
print(f"Status: {r.status_code}")
print(f"Headers: {dict(r.headers)}")
print(f"Body: {r.text[:500]}")

# 2. With allow_redirects
print("\n=== With redirects ===")
r2 = session.get(url, headers={"Accept": "application/json", "Cache-Control": "no-cache", "token": token}, allow_redirects=True)
print(f"Status: {r2.status_code}")
print(f"URL: {r2.url}")
print(f"Content-Type: {r2.headers.get('Content-Type', '')}")
print(f"Body: {r2.text[:500]}")