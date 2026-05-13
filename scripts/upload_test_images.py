#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量上传测试图片到 ImageGallery 系统

使用方法:
    python scripts/upload_test_images.py

配置:
    - 修改 CONFIG 中的参数
    - 修改 TEST_IMAGES 中的图片元数据（标题、分类、作者、标签等）

注意:
    - 由于 NextAuth 的 credentials provider 在 Edge Runtime 中可能有问题，
      本脚本采用直接操作 MinIO + MySQL 的方式，绕过 API 认证
"""

import os
import sys
import json
import hashlib
import random
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional

import requests
from PIL import Image, ImageDraw, ImageFont
from minio import Minio
from minio.error import S3Error
import mysql.connector

# 解决 Windows GBK 编码问题
if sys.platform == "win32":
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, errors='replace')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, errors='replace')

# =============================================================================
# 配置
# =============================================================================

CONFIG = {
    # 网站地址
    "BASE_URL": "http://localhost:3000",
    
    # MinIO 配置
    "MINIO_ENDPOINT": "82.157.176.188:9000",
    "MINIO_USE_SSL": False,
    "MINIO_ACCESS_KEY": "rustfsadmin",
    "MINIO_SECRET_KEY": "rustfsadmin",
    "MINIO_BUCKET": "image-gallery",
    "MINIO_PUBLIC_URL": "https://qq.qinqin.asia/storage/image-gallery",
    
    # 数据库配置（直接操作）
    "DB_HOST": "rm-bp128b691n9909ih3ho.mysql.rds.aliyuncs.com",
    "DB_PORT": 3306,
    "DB_NAME": "img",
    "DB_USER": "zhangsong",
    "DB_PASSWORD": "zs15210265092!",
    
    # 测试图片数量
    "TOTAL_COUNT": 50,
    
    # 输出目录
    "OUTPUT_DIR": "scripts/test_images",
}

# =============================================================================
# 测试图片元数据
# =============================================================================

CATEGORIES = [
    {"id": "nature", "label": "自然"},
    {"id": "architecture", "label": "建筑"},
    {"id": "food", "label": "美食"},
    {"id": "travel", "label": "旅行"},
    {"id": "fashion", "label": "时尚"},
    {"id": "technology", "label": "科技"},
    {"id": "art", "label": "艺术"},
    {"id": "lifestyle", "label": "生活"},
    {"id": "sports", "label": "运动"},
]

AUTHORS = [
    "张松", "李明", "王芳", "陈静", "刘洋",
    "赵敏", "孙磊", "周婷", "吴浩", "郑雅",
    "林峰", "黄雪", "徐涛", "高琳", "马强",
]

TAGS_POOL = [
    "风景", "日出", "日落", "海洋", "山脉", "森林", "城市",
    "夜景", "建筑", "摩天大楼", "桥梁", "街道", "咖啡馆",
    "美食", "甜点", "咖啡", "下午茶", "旅行", "背包",
    "相机", "摄影", "时尚", "穿搭", "配饰", "手表",
    "科技", "手机", "电脑", "AI", "代码", "编程",
    "艺术", "绘画", "雕塑", "设计", "色彩", "抽象",
    "生活", "家居", "装饰", "植物", "宠物", "阅读",
    "运动", "跑步", "瑜伽", "健身", "游泳", "骑行",
    "自然", "花朵", "动物", "天空", "云朵", "星空",
    "简约", "极简", "复古", "现代", "创意", "灵感",
]

# 不同宽高比（Pinterest 风格）
ASPECT_RATIOS = [
    (1080, 1350),   # 4:5 竖图
    (1080, 1620),   # 2:3 竖图
    (1080, 1920),   # 9:16 竖图
    (1080, 1080),   # 1:1 正方形
    (1080, 1440),   # 3:4 竖图
    (1080, 1800),   # 3:5 竖图
    (1080, 1215),   # 4:3 横图
    (1080, 1000),   # 略宽
]

# 颜色主题（用于生成图片）
COLOR_THEMES = [
    {"bg": (45, 85, 125), "accent": (255, 200, 100), "text": (255, 255, 255)},
    {"bg": (60, 120, 90), "accent": (255, 180, 100), "text": (255, 255, 255)},
    {"bg": (100, 60, 130), "accent": (255, 150, 200), "text": (255, 255, 255)},
    {"bg": (80, 100, 160), "accent": (255, 220, 100), "text": (255, 255, 255)},
    {"bg": (140, 80, 100), "accent": (255, 200, 150), "text": (255, 255, 255)},
    {"bg": (70, 140, 120), "accent": (255, 180, 100), "text": (255, 255, 255)},
    {"bg": (50, 90, 140), "accent": (255, 200, 100), "text": (255, 255, 255)},
    {"bg": (120, 100, 80), "accent": (255, 220, 150), "text": (255, 255, 255)},
    {"bg": (90, 110, 130), "accent": (255, 180, 100), "text": (255, 255, 255)},
    {"bg": (60, 80, 120), "accent": (255, 200, 100), "text": (255, 255, 255)},
]


def generate_test_image(
    width: int,
    height: int,
    title: str,
    category: dict,
    theme: dict,
    seed: int,
) -> Image.Image:
    """生成测试图片"""
    img = Image.new("RGB", (width, height), theme["bg"])
    draw = ImageDraw.Draw(img)
    
    # 添加渐变效果
    for y in range(height):
        alpha = y / height
        r = int(theme["bg"][0] + (theme["accent"][0] - theme["bg"][0]) * alpha * 0.3)
        g = int(theme["bg"][1] + (theme["accent"][1] - theme["bg"][1]) * alpha * 0.3)
        b = int(theme["bg"][2] + (theme["accent"][2] - theme["bg"][2]) * alpha * 0.3)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    # 添加装饰性几何图形
    random.seed(seed)
    num_shapes = random.randint(3, 8)
    for _ in range(num_shapes):
        shape_type = random.choice(["circle", "rect", "triangle"])
        x = random.randint(-50, width)
        y = random.randint(-50, height)
        size = random.randint(30, 150)
        alpha = random.randint(10, 40)
        
        if shape_type == "circle":
            draw.ellipse(
                [x, y, x + size, y + size],
                outline=theme["accent"][:3] + (alpha,),
                width=2
            )
        elif shape_type == "rect":
            draw.rectangle(
                [x, y, x + size, y + size // 2],
                outline=theme["accent"][:3] + (alpha,),
                width=2
            )
    
    # 添加标题文字
    try:
        # 尝试使用系统字体
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except:
        try:
            font_large = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
            font_small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 24)
        except:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
    
    # 标题居中
    text_bbox = draw.textbbox((0, 0), title, font=font_large)
    text_width = text_bbox[2] - text_bbox[0]
    text_x = (width - text_width) // 2
    text_y = height // 2 - 60
    
    # 文字阴影
    draw.text((text_x + 2, text_y + 2), title, fill=(0, 0, 0, 100), font=font_large)
    draw.text((text_x, text_y), title, fill=theme["text"], font=font_large)
    
    # 分类标签
    label = category["label"]
    label_bbox = draw.textbbox((0, 0), label, font=font_small)
    label_width = label_bbox[2] - label_bbox[0]
    label_x = (width - label_width) // 2
    label_y = text_y + 65
    
    # 标签背景
    padding = 12
    draw.rounded_rectangle(
        [label_x - padding, label_y - 8, label_x + label_width + padding, label_y + 32],
        radius=16,
        fill=theme["accent"][:3]
    )
    draw.text((label_x, label_y), label, fill=theme["text"], font=font_small)
    
    # 底部信息
    info_text = f"#{seed:04d}  |  ImageGallery"
    info_bbox = draw.textbbox((0, 0), info_text, font=font_small)
    info_width = info_bbox[2] - info_bbox[0]
    draw.text(((width - info_width) // 2, height - 50), info_text, fill=theme["text"], font=font_small)
    
    return img


def upload_to_minio(
    minio_client: Minio,
    bucket: str,
    storage_key: str,
    image: Image.Image,
    content_type: str = "image/jpeg",
) -> str:
    """上传图片到 MinIO"""
    # 保存为字节
    buffer_path = Path(f"/tmp/temp_{uuid.uuid4().hex[:8]}.jpg")
    image.save(buffer_path, format="JPEG", quality=85)
    
    file_size = os.path.getsize(buffer_path)
    with open(buffer_path, "rb") as f:
        minio_client.put_object(
            bucket,
            storage_key,
            f,
            file_size,
            content_type=content_type,
            metadata={"Cache-Control": "public, max-age=31536000"},
        )
    
    os.remove(buffer_path)
    return f"{CONFIG['MINIO_PUBLIC_URL']}/{storage_key}"


def insert_into_db(
    db_conn,
    title: str,
    description: str,
    filename: str,
    storage_key: str,
    url: str,
    thumbnail_url: str,
    width: int,
    height: int,
    file_size: int,
    mime_type: str,
    author: str,
    tags: str,
    category: str,
) -> int:
    """插入图片记录到数据库"""
    cursor = db_conn.cursor()
    cursor.execute(
        """INSERT INTO images 
           (title, description, filename, storage_key, url, thumbnail_url, 
            width, height, file_size, mime_type, author, tags, category)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        [title, description, filename, storage_key, url, thumbnail_url or None,
         width, height, file_size, mime_type, author, tags, category],
    )
    db_conn.commit()
    insert_id = cursor.lastrowid
    cursor.close()
    return insert_id


def main():
    """主函数"""
    print("=" * 60)
    print("[ImageGallery] 批量测试图片上传脚本")
    print("=" * 60)
    print()
    
    # 创建输出目录
    output_dir = Path(CONFIG["OUTPUT_DIR"])
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 初始化 MinIO 客户端
    print("[1/4] 初始化 MinIO 客户端...")
    minio_client = Minio(
        CONFIG["MINIO_ENDPOINT"],
        access_key=CONFIG["MINIO_ACCESS_KEY"],
        secret_key=CONFIG["MINIO_SECRET_KEY"],
        secure=CONFIG["MINIO_USE_SSL"],
    )
    
    # 确保桶存在
    try:
        if not minio_client.bucket_exists(CONFIG["MINIO_BUCKET"]):
            minio_client.make_bucket(CONFIG["MINIO_BUCKET"])
            print(f"   [OK] 创建桶: {CONFIG['MINIO_BUCKET']}")
        else:
            print(f"   [OK] 桶已存在: {CONFIG['MINIO_BUCKET']}")
    except S3Error as e:
        print(f"   [FAIL] MinIO 连接失败: {e}")
        return 1
    
    # 初始化数据库连接
    print("[2/4] 连接数据库...")
    try:
        db_conn = mysql.connector.connect(
            host=CONFIG["DB_HOST"],
            port=CONFIG["DB_PORT"],
            user=CONFIG["DB_USER"],
            password=CONFIG["DB_PASSWORD"],
            database=CONFIG["DB_NAME"],
        )
        print(f"   [OK] 数据库连接成功")
    except Exception as e:
        print(f"   [FAIL] 数据库连接失败: {e}")
        return 1
    
    # 生成测试图片元数据
    print(f"[3/4] 生成 {CONFIG['TOTAL_COUNT']} 张测试图片元数据...")
    test_images = []
    
    for i in range(1, CONFIG["TOTAL_COUNT"] + 1):
        category = random.choice(CATEGORIES)
        width, height = random.choice(ASPECT_RATIOS)
        theme = random.choice(COLOR_THEMES)
        author = random.choice(AUTHORS)
        
        # 生成标题
        title_templates = [
            "探索{label}之美",
            "{label}的灵感",
            "发现{label}",
            "{label}时光",
            "遇见{label}",
            "我的{label}日记",
            "{label}印象",
            "关于{label}",
            "爱上{label}",
            "品味{label}",
        ]
        title = random.choice(title_templates).format(label=category["label"])
        
        # 生成标签
        num_tags = random.randint(3, 8)
        tags = random.sample(TAGS_POOL, min(num_tags, len(TAGS_POOL)))
        tags_str = ",".join(tags)
        
        # 描述
        descriptions = [
            f"这是一张关于{category['label']}的图片，希望给你带来灵感。",
            f"记录{category['label']}的美好瞬间，分享生活点滴。",
            f"探索{category['label']}的无限可能，发现不一样的美。",
            f"在{category['label']}的世界里，寻找内心的宁静。",
            f"{category['label']}，让生活更美好。",
        ]
        description = random.choice(descriptions)
        
        test_images.append({
            "id": i,
            "title": title,
            "category": category["id"],
            "category_label": category["label"],
            "width": width,
            "height": height,
            "theme": theme,
            "author": author,
            "tags": tags_str,
            "description": description,
            "seed": i,
        })
    
    print(f"   [OK] 已生成 {len(test_images)} 张测试图片元数据")
    print()
    
    # 生成并上传图片
    print(f"[4/4] 开始生成并上传测试图片...")
    print("-" * 60)
    
    success_count = 0
    fail_count = 0
    
    for idx, img_meta in enumerate(test_images, 1):
        print(f"   [{idx:02d}/{CONFIG['TOTAL_COUNT']}] {img_meta['title']}...", end=" ", flush=True)
        
        try:
            # 生成图片
            image = generate_test_image(
                width=img_meta["width"],
                height=img_meta["height"],
                title=img_meta["title"],
                category={"id": img_meta["category"], "label": img_meta["category_label"]},
                theme=img_meta["theme"],
                seed=img_meta["seed"],
            )
            
            # 保存本地副本
            filename = f"{img_meta['id']:03d}_{img_meta['category']}_{uuid.uuid4().hex[:6]}.jpg"
            local_path = output_dir / filename
            image.save(local_path, format="JPEG", quality=85)
            file_size = os.path.getsize(local_path)
            
            # 上传到 MinIO
            storage_key = f"test/{filename}"
            public_url = upload_to_minio(
                minio_client,
                CONFIG["MINIO_BUCKET"],
                storage_key,
                image,
            )
            
            # 生成缩略图并上传
            thumb_filename = f"thumb_{filename}.webp"
            thumb_storage_key = f"test/{thumb_filename}"
            thumb_image = image.copy()
            thumb_image.thumbnail((400, 400))
            thumb_buffer_path = Path(f"/tmp/thumb_{uuid.uuid4().hex[:8]}.webp")
            thumb_image.save(thumb_buffer_path, format="WEBP", quality=80)
            thumb_size = os.path.getsize(thumb_buffer_path)
            
            with open(thumb_buffer_path, "rb") as f:
                minio_client.put_object(
                    CONFIG["MINIO_BUCKET"],
                    thumb_storage_key,
                    f,
                    thumb_size,
                    content_type="image/webp",
                )
            os.remove(thumb_buffer_path)
            thumb_url = f"{CONFIG['MINIO_PUBLIC_URL']}/{thumb_storage_key}"
            
            # 插入数据库
            insert_id = insert_into_db(
                db_conn,
                title=img_meta["title"],
                description=img_meta["description"],
                filename=filename,
                storage_key=storage_key,
                url=public_url,
                thumbnail_url=thumb_url,
                width=img_meta["width"],
                height=img_meta["height"],
                file_size=file_size,
                mime_type="image/jpeg",
                author=img_meta["author"],
                tags=img_meta["tags"],
                category=img_meta["category"],
            )
            
            print(f"[OK] ID={insert_id} | {img_meta['width']}x{img_meta['height']} | {img_meta['category_label']}")
            success_count += 1
                
        except Exception as e:
            print(f"[FAIL] {e}")
            fail_count += 1
    
    # 关闭连接
    db_conn.close()
    
    print("-" * 60)
    print()
    print("上传结果统计:")
    print(f"   [OK] 成功: {success_count} 张")
    print(f"   [FAIL] 失败: {fail_count} 张")
    print(f"   [DIR] 本地副本: {output_dir}")
    print()
    print("访问地址:")
    print(f"   首页: {CONFIG['BASE_URL']}")
    print(f"   管理后台: {CONFIG['BASE_URL']}/admin")
    print()
    print("=" * 60)
    
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
