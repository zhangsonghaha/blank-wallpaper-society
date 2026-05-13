import requests
s = requests.Session()
csrf_resp = s.get('http://localhost:3000/api/auth/csrf')
csrf = csrf_resp.json()['csrfToken']
print('CSRF:', csrf[:20])
resp = s.post('http://localhost:3000/api/auth/signin/credentials', data={
    'email': 'admin@img.com',
    'password': 'admin123',
    'redirect': 'false',
    'csrfToken': csrf,
})
print('Status:', resp.status_code)
print('Location:', resp.headers.get('Location', 'N/A'))
print('Response:', resp.text[:500])
print('Cookies:', list(s.cookies.keys()))
for k,v in s.cookies.items():
    print(f'  {k}: {v[:30]}...' if len(v)>30 else f'  {k}: {v}')
