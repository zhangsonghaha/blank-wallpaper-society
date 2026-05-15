import { query, safeQuery } from "@/lib/db";

/**
 * 分类 → 推荐标签映射
 */
const CATEGORY_TAG_MAP: Record<string, string[]> = {
  nature: ["风景", "山脉", "河流", "森林", "日出", "日落", "湖泊", "瀑布", "草原", "海滩"],
  city: ["城市", "建筑", "天际线", "街道", "夜景", "霓虹", "都市", "桥梁", "摩天楼", "广场"],
  portrait: ["人像", "写真", "人物", "面孔", "情感", "生活", "时尚", "气质", "黑白", "光影"],
  food: ["美食", "料理", "甜点", "咖啡", "饮品", "烘焙", "水果", "餐桌", "素食", "早餐"],
  travel: ["旅行", "风景", "探险", "公路", "地图", "背包", "自由", "远方", "旅途", "发现"],
  art: ["艺术", "创意", "抽象", "色彩", "设计", "插画", "绘画", "涂鸦", "几何", "梦幻"],
  animals: ["动物", "宠物", "野生", "猫咪", "狗狗", "鸟类", "海洋生物", "昆虫", "可爱", "自然"],
  minimal: ["极简", "简约", "纯净", "留白", "线条", "几何", "黑白", "宁静", "禅意", "秩序"],
};

/**
 * 颜色名称 → 关联标签映射
 * 基于 HSL 色彩空间的常见映射
 */
const COLOR_TAG_MAP: Record<string, string[]> = {
  red: ["热情", "活力", "红色", "温暖", "爱情", "火焰", "玫瑰"],
  orange: ["橙色", "暖阳", "秋天", "落日", "丰收", "温馨", "热情"],
  yellow: ["阳光", "金色", "明亮", "快乐", "温暖", "向日葵", "柠檬"],
  green: ["自然", "森林", "春天", "清新", "生机", "草地", "环保"],
  cyan: ["清新", "清澈", "冰蓝", "水面", "天空", "薄荷", "凉爽"],
  blue: ["天空", "海洋", "夜空", "宁静", "深邃", "忧郁", "星空"],
  purple: ["紫色", "梦幻", "神秘", "浪漫", "薰衣草", "魔法", "星空"],
  pink: ["粉色", "浪漫", "温柔", "樱花", "甜美", "少女", "花朵"],
  brown: ["大地", "木质", "复古", "咖啡", "秋天", "温暖", "自然"],
  black: ["黑暗", "夜晚", "深邃", "神秘", "优雅", "黑白", "极简"],
  white: ["白色", "纯净", "雪", "云", "简洁", "光明", "冬天"],
  gray: ["灰色", "阴天", "低调", "沉稳", "工业", "质感", "冷调"],
};

/**
 * 颜色 HEX → 颜色名称映射
 * 基于 HSL 值判断
 */
function hexToColorName(hex: string): string {
  // 移除 # 号
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  // 亮度极低 → 黑
  if (l < 0.15) return "black";
  // 亮度极高 → 白
  if (l > 0.85) return "white";
  // 饱和度极低 → 灰
  if (s < 0.1) return "gray";

  // 色相判断
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  h = h * 360;

  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "orange";
  if (h < 75) return "yellow";
  if (h < 165) return "green";
  if (h < 195) return "cyan";
  if (h < 265) return "blue";
  if (h < 305) return "purple";
  return "pink";
}

/**
 * 从文件名中提取智能标签
 * 规则：按下划线/连字符/空格分隔，过滤分辨率模式和扩展名
 */
export function extractTagsFromFilename(filename: string): string[] {
  if (!filename) return [];

  // 移除扩展名
  const name = filename.replace(/\.[^.]+$/, "");

  // 按下划线、连字符、空格分隔
  const words = name
    .split(/[_\-\s]+/)
    .filter((w) => w.length > 1) // 过滤单字符
    .filter((w) => {
      // 过滤分辨率模式 (如 1920x1080, 4k, 8k, 2k)
      if (/^\d+[x×]\d+$/i.test(w)) return false;
      if (/^[248]k$/i.test(w)) return false;
      // 过滤纯数字
      if (/^\d+$/.test(w)) return false;
      return true;
    })
    .map((w) => w.toLowerCase().trim());

  // 常见英文标签 → 中文映射
  const enToCn: Record<string, string> = {
    sunset: "日落", sunrise: "日出", beach: "海滩", ocean: "海洋",
    mountain: "山脉", forest: "森林", city: "城市", night: "夜晚",
    flower: "花朵", sky: "天空", cloud: "云", rain: "雨",
    snow: "雪", lake: "湖泊", river: "河流", desert: "沙漠",
    road: "道路", tree: "树木", garden: "花园", park: "公园",
    beautiful: "美丽", dark: "暗调", light: "明亮", colorful: "多彩",
    abstract: "抽象", nature: "自然", landscape: "风景", portrait: "人像",
    travel: "旅行", art: "艺术", minimal: "极简", wallpaper: "壁纸",
    background: "背景", desktop: "桌面", mobile: "手机",
  };

  const tags: string[] = [];
  for (const word of words) {
    // 优先中文映射
    if (enToCn[word]) {
      tags.push(enToCn[word]);
    } else if (/[\u4e00-\u9fff]/.test(word)) {
      // 中文直接作为标签
      tags.push(word);
    } else {
      // 英文首字母大写作为标签
      tags.push(word.charAt(0).toUpperCase() + word.slice(1));
    }
  }

  return tags;
}

/**
 * 基于分类推荐标签
 */
export function suggestTagsByCategory(category: string): string[] {
  return CATEGORY_TAG_MAP[category] || [];
}

/**
 * 基于色彩推荐标签
 */
export function suggestTagsByColor(dominantColor: string): string[] {
  const colorName = hexToColorName(dominantColor);
  return COLOR_TAG_MAP[colorName] || [];
}

/**
 * 从数据库获取热门标签
 */
export async function getPopularTags(topN: number = 10): Promise<string[]> {
  try {
    const rows = await safeQuery(
      "SELECT name FROM tags WHERE image_count > 0 ORDER BY image_count DESC LIMIT ?",
      [topN],
      []
    ) as any[];
    return rows.map((r: any) => r.name);
  } catch {
    return [];
  }
}

/**
 * 综合标签推荐
 * 合并多个来源的标签，去重后返回 topN
 */
export async function suggestTags(options: {
  filename?: string;
  category?: string;
  dominantColor?: string;
  topN?: number;
}): Promise<string[]> {
  const { filename, category, dominantColor, topN = 8 } = options;

  const allTags: string[] = [];
  const seen = new Set<string>();

  // 1. 文件名提取的标签（高优先级）
  if (filename) {
    const filenameTags = extractTagsFromFilename(filename);
    for (const tag of filenameTags) {
      if (!seen.has(tag)) {
        allTags.push(tag);
        seen.add(tag);
      }
    }
  }

  // 2. 分类推荐标签
  if (category) {
    const categoryTags = suggestTagsByCategory(category);
    for (const tag of categoryTags) {
      if (!seen.has(tag)) {
        allTags.push(tag);
        seen.add(tag);
      }
    }
  }

  // 3. 色彩推荐标签
  if (dominantColor) {
    const colorTags = suggestTagsByColor(dominantColor);
    for (const tag of colorTags) {
      if (!seen.has(tag)) {
        allTags.push(tag);
        seen.add(tag);
      }
    }
  }

  // 4. 热门标签补充
  if (allTags.length < topN) {
    const popularTags = await getPopularTags(topN - allTags.length);
    for (const tag of popularTags) {
      if (!seen.has(tag)) {
        allTags.push(tag);
        seen.add(tag);
        if (allTags.length >= topN) break;
      }
    }
  }

  return allTags.slice(0, topN);
}

/**
 * 智能标题生成
 * 基于文件名、分类、色彩生成友好标题
 */
export function suggestTitle(options: {
  filename?: string;
  category?: string;
  dominantColor?: string;
}): string {
  const { filename, category, dominantColor } = options;

  // 分类中文映射
  const categoryLabels: Record<string, string> = {
    nature: "自然风光",
    city: "城市建筑",
    portrait: "人像摄影",
    food: "美食",
    travel: "旅行",
    art: "艺术",
    animals: "动物",
    minimal: "极简",
  };

  // 颜色中文映射
  const colorLabels: Record<string, string> = {
    red: "红色", orange: "橙色", yellow: "金色", green: "绿色",
    cyan: "青色", blue: "蓝色", purple: "紫色", pink: "粉色",
    brown: "棕色", black: "黑色", white: "白色", gray: "灰色",
  };

  // 尝试从文件名生成标题
  if (filename) {
    const name = filename.replace(/\.[^.]+$/, "");
    // 检查是否包含中文
    if (/[\u4e00-\u9fff]/.test(name)) {
      // 中文文件名，替换分隔符为空格
      return name.replace(/[_\-]/g, " ").trim();
    }

    // 英文文件名 → 标题格式化
    const words = name
      .split(/[_\-\s]+/)
      .filter((w) => {
        if (/^\d+[x×]\d+$/i.test(w)) return false;
        if (/^[248]k$/i.test(w)) return false;
        if (/^\d+$/.test(w)) return false;
        return w.length > 1;
      });

    if (words.length > 0) {
      // Title Case 格式化
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  // 基于分类 + 色彩生成标题
  const parts: string[] = [];
  if (dominantColor) {
    const colorName = hexToColorName(dominantColor);
    const colorLabel = colorLabels[colorName];
    if (colorLabel) parts.push(colorLabel);
  }
  if (category) {
    const catLabel = categoryLabels[category];
    if (catLabel) parts.push(catLabel);
  }

  if (parts.length > 0) {
    return parts.join("") + "壁纸";
  }

  return "";
}

/**
 * 基于色彩猜测分类
 */
export function suggestCategoryByColor(dominantColor: string): string {
  const colorName = hexToColorName(dominantColor);

  const colorCategoryMap: Record<string, string> = {
    green: "nature",
    cyan: "nature",
    blue: "nature",
    brown: "nature",
    orange: "nature",
    red: "art",
    purple: "art",
    pink: "art",
    black: "minimal",
    white: "minimal",
    gray: "minimal",
    yellow: "travel",
  };

  return colorCategoryMap[colorName] || "";
}