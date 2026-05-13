import mysql.connector
conn = mysql.connector.connect(
    host='rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com',
    port=3306,
    user='zhangsong',
    password='zs15210265092!',
    database='img'
)
cursor = conn.cursor()
cursor.execute('SELECT email, password, name, role FROM users WHERE email="admin@img.com"')
row = cursor.fetchone()
if row:
    print('Email:', row[0])
    print('Password hash:', row[1])
    print('Name:', row[2])
    print('Role:', row[3])
else:
    print('User not found')
conn.close()
