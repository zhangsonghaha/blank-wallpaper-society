import hashlib
password = 'admin123'
h = hashlib.sha256(password.encode()).hexdigest()
print('Expected hash for admin123:', h)
