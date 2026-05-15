export interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  gps?: { lat: number; lng: number };
  orientation?: number;
  software?: string;
}

export interface GalleryImage {
  id: number;
  src: string;
  width: number;
  height: number;
  title: string;
  description: string;
  tags: string[];
  author: string;
  avatar: string;
  media_type?: "image" | "video";
  video_url?: string;
  poster_url?: string;
  uploaded_by?: number;
  exif?: ExifData | null;
  author_level?: number;
  author_level_title?: string;
}

export const categories = [
  { id: "all", label: "全部" },
  { id: "nature", label: "自然风光" },
  { id: "city", label: "城市建筑" },
  { id: "portrait", label: "人像摄影" },
  { id: "food", label: "美食" },
  { id: "travel", label: "旅行" },
  { id: "art", label: "艺术" },
  { id: "animals", label: "动物" },
  { id: "minimal", label: "极简" },
];

// 使用 picsum.photos 生成高质量占位图片
const picsum = (id: number, w: number, h: number) =>
  `https://picsum.photos/id/${id}/${w}/${h}`;

export const galleryImages: GalleryImage[] = [
  {
    id: 1,
    src: picsum(1015, 600, 800),
    width: 600,
    height: 800,
    title: "山间晨雾",
    description: "清晨的山间，薄雾缭绕，阳光透过云层洒下金色的光芒。",
    tags: ["nature", "travel"],
    author: "张摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhang`,
  },
  {
    id: 2,
    src: picsum(1016, 800, 600),
    width: 800,
    height: 600,
    title: "城市天际线",
    description: "夜幕降临，城市的灯光逐渐亮起，勾勒出美丽的天际线。",
    tags: ["city", "travel"],
    author: "李摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=li`,
  },
  {
    id: 3,
    src: picsum(1018, 600, 900),
    width: 600,
    height: 900,
    title: "静谧的湖面",
    description: "湖水如镜，倒映着蓝天白云和远处的山峦。",
    tags: ["nature", "minimal"],
    author: "王摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=wang`,
  },
  {
    id: 4,
    src: picsum(1020, 800, 800),
    width: 800,
    height: 800,
    title: "街头咖啡",
    description: "午后的阳光洒在咖啡杯上，氤氲的香气弥漫在空气中。",
    tags: ["food", "city"],
    author: "赵摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhao`,
  },
  {
    id: 5,
    src: picsum(1024, 600, 750),
    width: 600,
    height: 750,
    title: "秋日落叶",
    description: "金黄色的落叶铺满小径，踩上去发出沙沙的声响。",
    tags: ["nature", "art"],
    author: "孙摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=sun`,
  },
  {
    id: 6,
    src: picsum(1025, 700, 600),
    width: 700,
    height: 600,
    title: "现代建筑",
    description: "简洁的线条和几何形状，展现了现代建筑的美学。",
    tags: ["city", "minimal"],
    author: "周摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhou`,
  },
  {
    id: 7,
    src: picsum(1035, 600, 850),
    width: 600,
    height: 850,
    title: "花海",
    description: "漫山遍野的花朵竞相绽放，形成一片绚烂的花海。",
    tags: ["nature", "travel"],
    author: "吴摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=wu`,
  },
  {
    id: 8,
    src: picsum(1039, 800, 700),
    width: 800,
    height: 700,
    title: "老街巷",
    description: "斑驳的墙壁和青石板路，诉说着岁月的故事。",
    tags: ["city", "travel", "art"],
    author: "郑摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zheng`,
  },
  {
    id: 9,
    src: picsum(1040, 600, 800),
    width: 600,
    height: 800,
    title: "森林深处",
    description: "阳光透过树叶的缝隙洒下斑驳的光影，神秘而宁静。",
    tags: ["nature", "animals"],
    author: "陈摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=chen`,
  },
  {
    id: 10,
    src: picsum(1044, 800, 600),
    width: 800,
    height: 600,
    title: "海边日落",
    description: "夕阳将天空染成橙红色，海浪轻轻拍打着沙滩。",
    tags: ["nature", "travel"],
    author: "林摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=lin`,
  },
  {
    id: 11,
    src: picsum(1050, 600, 900),
    width: 600,
    height: 900,
    title: "人像",
    description: "光影交错间，捕捉最真实的情感瞬间。",
    tags: ["portrait", "art"],
    author: "黄摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=huang`,
  },
  {
    id: 12,
    src: picsum(1055, 700, 700),
    width: 700,
    height: 700,
    title: "精致甜点",
    description: "每一道甜点都是艺术品，精致得让人不忍下口。",
    tags: ["food", "art"],
    author: "杨摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=yang`,
  },
  {
    id: 13,
    src: picsum(1060, 600, 750),
    width: 600,
    height: 750,
    title: "雪山之巅",
    description: "皑皑白雪覆盖着山峰，在蓝天的映衬下格外壮丽。",
    tags: ["nature", "travel", "minimal"],
    author: "刘摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=liu`,
  },
  {
    id: 14,
    src: picsum(1066, 800, 650),
    width: 800,
    height: 650,
    title: "都市夜景",
    description: "霓虹灯闪烁，车流如织，城市的夜晚充满活力。",
    tags: ["city", "travel"],
    author: "张摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhang2`,
  },
  {
    id: 15,
    src: picsum(1067, 600, 850),
    width: 600,
    height: 850,
    title: "可爱猫咪",
    description: "慵懒的午后，猫咪蜷缩在窗台上晒太阳。",
    tags: ["animals", "minimal"],
    author: "李摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=li2`,
  },
  {
    id: 16,
    src: picsum(1069, 750, 600),
    width: 750,
    height: 600,
    title: "抽象艺术",
    description: "色彩与线条的碰撞，创造出独特的视觉体验。",
    tags: ["art", "minimal"],
    author: "王摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=wang2`,
  },
  {
    id: 17,
    src: picsum(1070, 600, 800),
    width: 600,
    height: 800,
    title: "瀑布",
    description: "飞流直下三千尺，水花四溅，气势磅礴。",
    tags: ["nature", "travel"],
    author: "赵摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhao2`,
  },
  {
    id: 18,
    src: picsum(1074, 800, 700),
    width: 800,
    height: 700,
    title: "街头艺人",
    description: "城市的角落里，艺人们用音乐和表演点亮生活。",
    tags: ["city", "portrait", "art"],
    author: "孙摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=sun2`,
  },
  {
    id: 19,
    src: picsum(1077, 600, 900),
    width: 600,
    height: 900,
    title: "竹林",
    description: "翠绿的竹林随风摇曳，发出沙沙的声响，宁静致远。",
    tags: ["nature", "minimal"],
    author: "周摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhou2`,
  },
  {
    id: 20,
    src: picsum(1080, 700, 800),
    width: 700,
    height: 800,
    title: "美食盛宴",
    description: "色香味俱全的美食，让人垂涎欲滴。",
    tags: ["food", "travel"],
    author: "吴摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=wu2`,
  },
  {
    id: 21,
    src: picsum(1084, 600, 700),
    width: 600,
    height: 700,
    title: "沙漠",
    description: "无垠的沙漠，金色的沙丘在夕阳下泛着光芒。",
    tags: ["nature", "travel", "minimal"],
    author: "郑摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zheng2`,
  },
  {
    id: 22,
    src: picsum(1089, 800, 800),
    width: 800,
    height: 800,
    title: "窗边的光",
    description: "阳光透过窗户洒进房间，光影交错，温暖而静谧。",
    tags: ["minimal", "art"],
    author: "陈摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=chen2`,
  },
  {
    id: 23,
    src: picsum(1091, 600, 850),
    width: 600,
    height: 850,
    title: "野生动物",
    description: "在自然栖息地中，野生动物展现出最真实的一面。",
    tags: ["animals", "nature"],
    author: "林摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=lin2`,
  },
  {
    id: 24,
    src: picsum(1100, 750, 650),
    width: 750,
    height: 650,
    title: "雨中街景",
    description: "雨中的街道，霓虹灯倒映在湿漉漉的地面上，如梦如幻。",
    tags: ["city", "travel", "art"],
    author: "黄摄影师",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=huang2`,
  },
];