"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Image as ImageIcon,
  Download,
  Heart,
  TrendingUp,
  TrendingDown,
  HardDrive,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ==================== 类型定义 ==================== */

interface OverviewData {
  totalUsers: number;
  totalImages: number;
  totalDownloads: number;
  totalFavorites: number;
  recentActiveUsers: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendData {
  newUsers: TrendPoint[];
  newImages: TrendPoint[];
  downloads: TrendPoint[];
}

interface CategoryItem {
  name: string;
  slug: string;
  count: number;
}

interface TopImage {
  id: number;
  title: string;
  thumbnailUrl: string;
  downloadCount: number;
  width: number;
  height: number;
}

interface StorageInfo {
  totalSize: number;
  fileCount: number;
}

interface StatsData {
  overview: OverviewData;
  trends: TrendData;
  categoryDistribution: CategoryItem[];
  topImages: TopImage[];
  storage: StorageInfo;
}

/* ==================== 工具函数 ==================== */

const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
};

const CATEGORY_COLORS = [
  "var(--color-pinterest)",
  "#4F46E5",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#0891B2",
  "#DC2626",
  "#2563EB",
  "#65A30D",
  "#C026D3",
];

/* ==================== 统计卡片 ==================== */

function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  trend,
  color,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subLabel?: string;
  trend?: number;
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          {trend !== undefined && (
            <div
              className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                trend >= 0
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-red-700 bg-red-50"
              }`}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            {formatNumber(value)}
          </p>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">{label}</p>
          {subLabel && (
            <p className="text-xs text-[var(--color-ash)] mt-0.5">
              {subLabel}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================== SVG 折线图 ==================== */

function TrendChart({
  data,
  label,
  color,
}: {
  data: TrendPoint[];
  label: string;
  color: string;
}) {
  if (!data.length) return null;

  const W = 600;
  const H = 200;
  const PX = 40;
  const PY = 24;
  const chartW = W - PX * 2;
  const chartH = H - PY * 2;

  const maxVal = Math.max(...data.map((d) => d.count), 1);

  const points = data.map((d, i) => ({
    x: PX + (i / (data.length - 1 || 1)) * chartW,
    y: PY + chartH - (d.count / maxVal) * chartH,
  }));

  // 柱状图模式：每个数据点占的宽度
  const barWidth = chartW / data.length * 0.6;
  const barGap = chartW / data.length * 0.4;

  // 构建面积路径
  const areaPath = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");
  const areaFillPath = `${areaPath} L${points[points.length - 1].x},${PY + chartH} L${points[0].x},${PY + chartH} Z`;

  // 网格线
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = PY + chartH - ratio * chartH;
    const val = Math.round(ratio * maxVal);
    return { y, val };
  });

  // X轴标签：每5天显示
  const xLabels = data
    .map((d, i) => {
      if (i % 7 === 0 || i === data.length - 1) {
        const x = PX + (i / (data.length - 1 || 1)) * chartW;
        const label = d.date.slice(5); // MM-DD
        return { x, label };
      }
      return null;
    })
    .filter(Boolean) as { x: number; label: string }[];

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* 网格线 */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PX}
              y1={g.y}
              x2={W - PX}
              y2={g.y}
              stroke="var(--color-hairline-soft)"
              strokeWidth={1}
              strokeDasharray={i > 0 ? "4,4" : "0"}
            />
            <text
              x={PX - 6}
              y={g.y + 4}
              textAnchor="end"
              fill="var(--color-ash)"
              fontSize={10}
            >
              {formatNumber(g.val)}
            </text>
          </g>
        ))}

        {/* 面积填充 */}
        <path d={areaFillPath} fill={color} fillOpacity={0.08} />

        {/* 折线 */}
        <path
          d={areaPath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 数据点（hover目标） */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="white"
            stroke={color}
            strokeWidth={2}
            className="opacity-0 hover:opacity-100 transition-opacity"
          />
        ))}

        {/* X轴标签 */}
        {xLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={H - 4}
            textAnchor="middle"
            fill="var(--color-ash)"
            fontSize={10}
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ==================== 分类分布横向条形图 ==================== */

function CategoryChart({ data }: { data: CategoryItem[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={item.slug} className="group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-[var(--color-body)]">
              {item.name}
            </span>
            <span className="text-xs text-[var(--color-mute)]">
              {item.count} 张
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--color-surface-card)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无分类数据
        </p>
      )}
    </div>
  );
}

/* ==================== 热门壁纸列表 ==================== */

function TopImagesList({ data }: { data: TopImage[] }) {
  return (
    <div className="space-y-2">
      {data.map((img, i) => (
        <div
          key={img.id}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors"
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < 3
                ? "bg-[var(--color-pinterest)] text-white"
                : "bg-[var(--color-surface-card)] text-[var(--color-mute)]"
            }`}
          >
            {i + 1}
          </span>
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
            <img
              src={img.thumbnailUrl}
              alt={img.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{img.title}</p>
            <p className="text-xs text-[var(--color-ash)]">
              {img.width}×{img.height}
            </p>
          </div>
          <div className="flex items-center gap-1 text-sm text-[var(--color-mute)] flex-shrink-0">
            <Download className="w-3.5 h-3.5" />
            {formatNumber(img.downloadCount)}
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无下载数据
        </p>
      )}
    </div>
  );
}

/* ==================== 存储概览 ==================== */

function StorageOverview({ storage }: { storage: StorageInfo }) {
  // 假设100GB为上限做进度条展示
  const TOTAL_QUOTA = 100 * 1024 * 1024 * 1024; // 100GB
  const usagePercent = Math.min((storage.totalSize / TOTAL_QUOTA) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-[var(--color-mute)]" />
          <span className="text-sm font-medium">存储使用</span>
        </div>
        <span className="text-xs text-[var(--color-mute)]">
          {formatSize(storage.totalSize)} / {formatSize(TOTAL_QUOTA)}
        </span>
      </div>
      <div className="h-3 rounded-full bg-[var(--color-surface-card)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${usagePercent}%`,
            backgroundColor:
              usagePercent > 80
                ? "var(--color-error)"
                : "var(--color-pinterest)",
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--color-ash)]">
        <span>共 {storage.fileCount} 个文件</span>
        <span>使用率 {usagePercent.toFixed(1)}%</span>
      </div>
    </div>
  );
}

/* ==================== 主仪表盘组件 ==================== */

export default function DashboardTab() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) throw new Error("获取数据失败");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || "获取数据失败");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-[var(--color-error)] mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[var(--color-pinterest)] hover:underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="w-10 h-10 rounded-xl mb-3" />
                <Skeleton className="w-20 h-7 mb-1" />
                <Skeleton className="w-14 h-4" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="w-28 h-5" />
              </CardHeader>
              <CardContent>
                <Skeleton className="w-full h-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 计算趋势（对比前后两周）
  const calcTrend = (trend: TrendPoint[]): number => {
    if (trend.length < 14) return 0;
    const mid = Math.floor(trend.length / 2);
    const firstHalf = trend.slice(0, mid).reduce((s, d) => s + d.count, 0);
    const secondHalf = trend.slice(mid).reduce((s, d) => s + d.count, 0);
    if (firstHalf === 0) return secondHalf > 0 ? 100 : 0;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  };

  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="总用户数"
          value={data.overview.totalUsers}
          subLabel={`近7日活跃 ${data.overview.recentActiveUsers} 人`}
          trend={calcTrend(data.trends.newUsers)}
          color="#4F46E5"
          bgColor="#EEF2FF"
        />
        <StatCard
          icon={ImageIcon}
          label="总图片数"
          value={data.overview.totalImages}
          trend={calcTrend(data.trends.newImages)}
          color="var(--color-pinterest)"
          bgColor="#FEE2E2"
        />
        <StatCard
          icon={Download}
          label="总下载量"
          value={data.overview.totalDownloads}
          trend={calcTrend(data.trends.downloads)}
          color="#059669"
          bgColor="#D1FAE5"
        />
        <StatCard
          icon={Heart}
          label="总收藏数"
          value={data.overview.totalFavorites}
          color="#D97706"
          bgColor="#FEF3C7"
        />
      </div>

      {/* 趋势图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4F46E5]" />
              新增用户趋势
            </CardTitle>
            <CardDescription>近30天每日新增注册用户</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.trends.newUsers}
              label="新增用户"
              color="#4F46E5"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[var(--color-pinterest)]" />
              新增图片趋势
            </CardTitle>
            <CardDescription>近30天每日新增上传图片</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.trends.newImages}
              label="新增图片"
              color="var(--color-pinterest)"
            />
          </CardContent>
        </Card>
      </div>

      {/* 下载趋势 + 分类分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4 text-[#059669]" />
              下载趋势
            </CardTitle>
            <CardDescription>近30天每日下载量</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.trends.downloads}
              label="下载数"
              color="#059669"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#D97706]" />
              分类分布
            </CardTitle>
            <CardDescription>各分类壁纸数量统计</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[280px] overflow-y-auto">
            <CategoryChart data={data.categoryDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* 热门壁纸 + 存储概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-[var(--color-pinterest)]" />
              热门壁纸 Top 10
            </CardTitle>
            <CardDescription>下载量排行</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto">
            <TopImagesList data={data.topImages} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#7C3AED]" />
              存储概览
            </CardTitle>
            <CardDescription>MinIO 存储使用情况</CardDescription>
          </CardHeader>
          <CardContent>
            <StorageOverview storage={data.storage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}