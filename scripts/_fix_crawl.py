"""临时脚本：修复 crawl_with_scrapling.py 中损坏的 IMAGE_EXT_PATTERN"""
import os

filepath = os.path.join(os.path.dirname(__file__), 'crawl_with_scrapling.py')

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到关键行
image_ext_start = None
guess_tags_line = None

for i, line in enumerate(lines):
    if 'IMAGE_EXT_PATTERN = re.compile' in line and image_ext_start is None:
        image_ext_start = i  # 0-based
    if 'def _guess_tags' in line and guess_tags_line is None:
        guess_tags_line = i  # 0-based

print(f"IMAGE_EXT_PATTERN starts at line {image_ext_start + 1}")
print(f"_guess_tags at line {guess_tags_line + 1}")

# 替换从 IMAGE_EXT_PATTERN 行到 _guess_tags 前一行
# 保留注释行（IMAGE_EXT_PATTERN 之前的注释行）
# 找到注释开始行
comment_start = image_ext_start
for i in range(image_ext_start - 1, -1, -1):
    stripped = lines[i].strip()
    if stripped.startswith('#') or stripped == '':
        comment_start = i
    else:
        break

# 新的正确代码
new_lines = lines[:comment_start]
new_lines.append('\n')
new_lines.append('    # 图片后缀模式：标准后缀 + 带 CDN 处理参数的非标准后缀\n')
new_lines.append('    # 匹配 .jpg, .jpeg, .png, .webp, .bmp, .gif\n')
new_lines.append('    # 也匹配 .jpg-pcthumbs, .jpeg_webp, .jpg_800x0, .png_small 等\n')
new_lines.append("    IMAGE_EXT_PATTERN = re.compile(\n")
new_lines.append("        r'\\.(jpe?g|png|webp|bmp|gif|avif)'\n")
new_lines.append("        r'(?:[_\\-.][\\w\\d]+)*'  # 后缀变体: -pcthumbs, _webp, _800x0, .thumb 等\n")
new_lines.append("        r'$'\n")
new_lines.append('    )\n')
new_lines.append('\n')
# 添加从 _guess_tags 开始到结尾的所有行
new_lines.extend(lines[guess_tags_line:])

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Fixed! Original: {len(lines)} lines, New: {len(new_lines)} lines")