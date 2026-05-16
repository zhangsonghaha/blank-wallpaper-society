"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Image as ImageIcon,
  Download,
  Heart,
  Eye,
  TrendingUp,
  TrendingDown,
  HardDrive,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Video,
  Monitor,
  Crown,
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
import { Button } from "@/components/ui/button";

/* ==================== 类型定义 ==================== */

interface OverviewData {
  totalUsers: number;
  totalImages: number;
  totalDownloads: number;
  totalFavorites: number;
  totalViews: number;
  pendingReview: number;
  openReports: number;
  recentComments: number;
  recentActiveUsers: number;
  nsfwFlagged: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface TrendData {
  newUsers: TrendPoint[];
  newImages: TrendPoint[];
  downloads: TrendPoint[];
  uploads: TrendPoint[];
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
  viewCount: number;
  width: number;
  height: number;
  category: string;
}

interface TopCreator {
  userId: number;
  name: string;
  avatar: string;
  uploadCount: number;
  totalDownloads: number;
  totalViews: number;
}

interface StorageInfo {
  totalSize: number;
  fileCount: number;
}

interface MediaTypeItem {
  type: string;
  count: number;
}

interface ResolutionItem {
  resolution: string;
  count: number;
}

interface RecentUser {
  id: number;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
}

interface StatsData {
  overview: OverviewData;
  trends: TrendData;
  categoryDistribution: CategoryItem[];
  topImages: TopImage[];
  topCreators: TopCreator[];
  storage: StorageInfo;
  mediaTypes: MediaTypeItem[];
  resolutions: ResolutionItem[];
  recentUsers: RecentUser[];
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

const RESOLUTION_COLORS: Record<string, string> = {
  "4K+": "#7C3AED",
  "2K": "#4F46E5",
  "1080p": "#059669",
  "720p": "#D97706",
  SD: "#6B7280",
};

const MEDIA_TYPE_COLORS: Record<string, string> = {
  image: "#4F46E5",
  video: "var(--color-pinterest)",
};

/* ==================== 统计卡片 ==================== */

function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  trend,
  color,
  bgColor,
  onClick,
  urgent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subLabel?: string;
  trend?: number;
  color: string;
  bgColor: string;
  onClick?: () => void;
  urgent?: boolean;
}) {
  return (
    <Card
      className={`transition-all hover:shadow-md active:scale-[0.97] ${onClick ? "cursor-pointer hover:border-[var(--color-pinterest)]/30" : ""} ${urgent ? "ring-2 ring-red-200" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        {onClick && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-ash)]" />
          </div>
        )}
        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex items-center gap-1.5">
            {urgent && value > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                需处理
              </Badge>
            )}
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

/* ==================== SVG 柱状图 + 折线图 ==================== */

function TrendChart({
  data,
  label,
  color,
  type = "bar",
}: {
  data: TrendPoint[];
  label: string;
  color: string;
  type?: "bar" | "line";
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  // 柱状图宽度
  const barGroupWidth = chartW / data.length;
  const barWidth = Math.max(barGroupWidth * 0.6, 4);

  // 网格线
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = PY + chartH - ratio * chartH;
    const val = Math.round(ratio * maxVal);
    return { y, val };
  });

  // X轴标签
  const step = Math.max(Math.ceil(data.length / 7), 1);
  const xLabels = data
    .map((d, i) => {
      if (i % step === 0 || i === data.length - 1) {
        const x = PX + (i / (data.length - 1 || 1)) * chartW;
        const lbl = d.date.slice(5); // MM-DD
        return { x, label: lbl };
      }
      return null;
    })
    .filter(Boolean) as { x: number; label: string }[];

  // 折线路径
  const linePath = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(" ");
  const areaFillPath = `${linePath} L${points[points.length - 1].x},${PY + chartH} L${points[0].x},${PY + chartH} Z`;

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

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

        {type === "bar" ? (
          /* 柱状图 */
          data.map((d, i) => {
            const x = PX + (i / data.length) * chartW + barGroupWidth * 0.2;
            const barH = (d.count / maxVal) * chartH;
            const y = PY + chartH - barH;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                fillOpacity={hoveredIndex !== null && hoveredIndex !== i ? 0.3 : 0.75}
                rx={2}
                className="transition-all duration-150"
              />
            );
          })
        ) : (
          /* 折线+面积 */
          <>
            <path d={areaFillPath} fill={color} fillOpacity={0.08} />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Hover 指示线 */}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              y1={PY}
              x2={hoveredPoint.x}
              y2={PY + chartH}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3,3"
              fillOpacity={0.5}
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r={4}
              fill="white"
              stroke={color}
              strokeWidth={2}
            />
          </>
        )}

        {/* 不可见的 hover 区域 */}
        {data.map((_, i) => (
          <rect
            key={`h${i}`}
            x={PX + (i / data.length) * chartW}
            y={PY}
            width={barGroupWidth}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
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
      {/* Tooltip */}
      {hovered && hoveredPoint && (
        <div
          className="absolute pointer-events-none bg-[var(--color-ink)] text-white text-xs px-2.5 py-1.5 rounded-lg shadow-lg z-10"
          style={{
            left: `${(hoveredPoint.x / W) * 100}%`,
            top: `${((hoveredPoint.y - 30) / H) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="font-medium">{hovered.date}</div>
          <div>
            {label}: {formatNumber(hovered.count)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 分类分布横向条形图 ==================== */

function CategoryChart({ data }: { data: CategoryItem[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={item.slug} className="group">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-[var(--color-body)]">
              {item.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-mute)]">
                {((item.count / total) * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-[var(--color-ash)]">
                {item.count} 张
              </span>
            </div>
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
            <div className="flex items-center gap-2 text-xs text-[var(--color-ash)]">
              <span>{img.width}×{img.height}</span>
              {img.category && <Badge variant="secondary" className="text-[10px] px-1 py-0">{img.category}</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
              <Download className="w-3.5 h-3.5" />
              {formatNumber(img.downloadCount)}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-ash)]">
              <Eye className="w-3 h-3" />
              {formatNumber(img.viewCount)}
            </div>
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

/* ==================== 热门创作者列表 ==================== */

function TopCreatorsList({ data }: { data: TopCreator[] }) {
  return (
    <div className="space-y-2">
      {data.map((creator, i) => (
        <div
          key={creator.userId}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors"
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < 3
                ? "bg-amber-500 text-white"
                : "bg-[var(--color-surface-card)] text-[var(--color-mute)]"
            }`}
          >
            {i + 1}
          </span>
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
            {creator.avatar ? (
              <img
                src={creator.avatar}
                alt={creator.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-medium text-[var(--color-mute)]">
                {creator.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{creator.name}</p>
            <p className="text-xs text-[var(--color-ash)]">
              {creator.uploadCount} 张作品
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
              <Download className="w-3.5 h-3.5" />
              {formatNumber(creator.totalDownloads)}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-ash)]">
              <Eye className="w-3 h-3" />
              {formatNumber(creator.totalViews)}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无创作者数据
        </p>
      )}
    </div>
  );
}

/* ==================== 存储概览 ==================== */

function StorageOverview({ storage }: { storage: StorageInfo }) {
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

/* ==================== 环形图（SVG） ==================== */

function DonutChart({
  segments,
  total,
  size = 120,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  size?: number;
}) {
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dashLength = pct * circumference;
    const arc = {
      ...seg,
      dashLength,
      dashOffset: -currentOffset,
      pct,
    };
    currentOffset += dashLength;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="flex-shrink-0">
        {/* 背景圆环 */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-surface-card)"
          strokeWidth={strokeWidth}
        />
        {/* 各段 */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${center} ${center})`}
            className="transition-all duration-700"
          />
        ))}
        {/* 中心文字 */}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          fill="var(--color-ink)"
          fontSize={16}
          fontWeight="bold"
        >
          {formatNumber(total)}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          fill="var(--color-ash)"
          fontSize={10}
        >
          总计
        </text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-[var(--color-body)] flex-1">{seg.label}</span>
            <span className="text-xs font-medium text-[var(--color-ink)]">
              {seg.value}
            </span>
            <span className="text-xs text-[var(--color-ash)]">
              ({((seg.value / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==================== 快捷操作面板 ==================== */

function QuickActions({
  pendingReview,
  openReports,
  onNavigate,
}: {
  pendingReview: number;
  openReports: number;
  onNavigate: (tab: string) => void;
}) {
  const actions = [
    {
      id: "review",
      label: "待审核图片",
      count: pendingReview,
      icon: ShieldAlert,
      color: "#DC2626",
      bgColor: "#FEE2E2",
      show: pendingReview > 0,
    },
    {
      id: "reports",
      label: "待处理举报",
      count: openReports,
      icon: AlertTriangle,
      color: "#D97706",
      bgColor: "#FEF3C7",
      show: openReports > 0,
    },
  ].filter((a) => a.show);

  if (actions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            运营状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-emerald-600 font-medium">一切正常</p>
            <p className="text-xs text-[var(--color-ash)] mt-1">没有待处理的紧急任务</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          待处理任务
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onNavigate(action.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors text-left group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: action.bgColor }}
            >
              <action.icon className="w-4.5 h-4.5" style={{ color: action.color }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-[var(--color-ash)]">点击前往处理</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">
                {action.count}
              </Badge>
              <ChevronRight className="w-4 h-4 text-[var(--color-ash)] group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/* ==================== 近期注册用户 ==================== */

function RecentUsersList({ data }: { data: RecentUser[] }) {
  return (
    <div className="space-y-2">
      {data.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-medium text-[var(--color-mute)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-[var(--color-ash)] truncate">{user.email}</p>
          </div>
          <span className="text-xs text-[var(--color-ash)] flex-shrink-0">
            {new Date(user.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-sm text-[var(--color-ash)] text-center py-4">
          暂无用户数据
        </p>
      )}
    </div>
  );
}

/* ==================== 主仪表盘组件 ==================== */

export default function DashboardTab() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(60);
  // 点击涟漪效果
  const [ripple, setRipple] = useState<{ id: number; x: number; y: number } | null>(null);

  const fetchStats = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/stats?days=${days}`);
      if (!res.ok) throw new Error("获取数据失败");
      const json = await res.json();
      setData({
        overview: {
          totalUsers: Number(json?.overview?.totalUsers ?? 0),
          totalImages: Number(json?.overview?.totalImages ?? 0),
          totalDownloads: Number(json?.overview?.totalDownloads ?? 0),
          totalFavorites: Number(json?.overview?.totalFavorites ?? 0),
          totalViews: Number(json?.overview?.totalViews ?? 0),
          pendingReview: Number(json?.overview?.pendingReview ?? 0),
          openReports: Number(json?.overview?.openReports ?? 0),
          recentComments: Number(json?.overview?.recentComments ?? 0),
          recentActiveUsers: Number(json?.overview?.recentActiveUsers ?? 0),
          nsfwFlagged: Number(json?.overview?.nsfwFlagged ?? 0),
        },
        trends: {
          newUsers: Array.isArray(json?.trends?.newUsers) ? json.trends.newUsers : [],
          newImages: Array.isArray(json?.trends?.newImages) ? json.trends.newImages : [],
          downloads: Array.isArray(json?.trends?.downloads) ? json.trends.downloads : [],
          uploads: Array.isArray(json?.trends?.uploads) ? json.trends.uploads : [],
        },
        categoryDistribution: Array.isArray(json?.categoryDistribution) ? json.categoryDistribution : [],
        topImages: Array.isArray(json?.topImages) ? json.topImages : [],
        topCreators: Array.isArray(json?.topCreators) ? json.topCreators : [],
        storage: {
          totalSize: Number(json?.storage?.totalSize ?? 0),
          fileCount: Number(json?.storage?.fileCount ?? 0),
        },
        mediaTypes: Array.isArray(json?.mediaTypes) ? json.mediaTypes : [],
        resolutions: Array.isArray(json?.resolutions) ? json.resolutions : [],
        recentUsers: Array.isArray(json?.recentUsers) ? json.recentUsers : [],
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || "获取数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  // 初始加载
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 自动刷新倒计时
  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(60);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchStats(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchStats]);

  // 点击涟漪效果
  const handleRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({
      id: Date.now(),
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setTimeout(() => setRipple(null), 600);
  }, []);

  // 导航到其他tab
  const navigateToTab = useCallback((tabId: string) => {
    const event = new CustomEvent("admin:navigate", { detail: tabId });
    window.dispatchEvent(event);
  }, []);

  if (error && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-[var(--color-error)] mb-3 font-medium">{error}</p>
          <Button
            onClick={() => fetchStats(true)}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 计算趋势
  const calcTrend = (trend: TrendPoint[]): number => {
    if (trend.length < 7) return 0;
    const mid = Math.floor(trend.length / 2);
    const firstHalf = trend.slice(0, mid).reduce((s, d) => s + d.count, 0);
    const secondHalf = trend.slice(mid).reduce((s, d) => s + d.count, 0);
    if (firstHalf === 0) return secondHalf > 0 ? 100 : 0;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  };

  const hasAlerts = data ? (data.overview.pendingReview > 0 || data.overview.openReports > 0) : false;

  return (
    <div className="space-y-6">
      {/* 顶部工具栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">数据概览</h2>
          {hasAlerts && (
            <Badge variant="destructive" className="animate-pulse">
              {data!.overview.pendingReview + data!.overview.openReports} 项待处理
            </Badge>
          )}
          {lastUpdated && (
            <span className="text-xs text-[var(--color-ash)] hidden sm:inline">
              更新于 {lastUpdated.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 时间范围选择 */}
          <div className="flex items-center bg-[var(--color-surface-card)] rounded-lg p-0.5">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={(e) => { handleRipple(e); setDays(d); }}
                className={`relative overflow-hidden px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  days === d
                    ? "bg-white text-[var(--color-ink)] shadow-sm"
                    : "text-[var(--color-ash)] hover:text-[var(--color-ink)]"
                }`}
              >
                {ripple && <span className="absolute inset-0 rounded-md animate-ping bg-[var(--color-pinterest)]/10" />}
                {d}天
              </button>
            ))}
          </div>
          {/* 图表类型切换 */}
          <div className="flex items-center bg-[var(--color-surface-card)] rounded-lg p-0.5">
            <button
              onClick={(e) => { handleRipple(e); setChartType("bar"); }}
              className={`relative overflow-hidden px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                chartType === "bar"
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ash)] hover:text-[var(--color-ink)]"
              }`}
            >
              柱状
            </button>
            <button
              onClick={(e) => { handleRipple(e); setChartType("line"); }}
              className={`relative overflow-hidden px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                chartType === "line"
                  ? "bg-white text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ash)] hover:text-[var(--color-ink)]"
              }`}
            >
              折线
            </button>
          </div>
          {/* 自动刷新开关 */}
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={(e) => { handleRipple(e); setAutoRefresh(!autoRefresh); }}
            className="gap-1.5"
          >
            <Activity className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse" : ""}`} />
            {autoRefresh ? `${countdown}s` : "自动"}
          </Button>
          {/* 刷新按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { handleRipple(e); fetchStats(true); }}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 刷新中覆盖层 */}
      {refreshing && data && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-white shadow-lg rounded-lg px-4 py-2 border">
          <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-pinterest)]" />
          <span className="text-sm text-[var(--color-ink)]">正在刷新数据...</span>
        </div>
      )}

      {loading || !data ? (
        /* 加载骨架屏 - 带脉冲动画 */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-5">
                  <Skeleton className="w-10 h-10 rounded-xl mb-3 animate-pulse" />
                  <Skeleton className="w-20 h-7 mb-1 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                  <Skeleton className="w-14 h-4 animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-5">
                  <Skeleton className="w-10 h-10 rounded-xl mb-3 animate-pulse" />
                  <Skeleton className="w-16 h-7 mb-1 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                  <Skeleton className="w-20 h-4 animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <Skeleton className="w-28 h-5 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                </CardHeader>
                <CardContent>
                  <Skeleton className="w-full h-48 animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 核心指标卡片 - 第一行 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              icon={Users}
              label="总用户数"
              value={data.overview.totalUsers}
              subLabel={`近${days}日活跃 ${data.overview.recentActiveUsers} 人`}
              trend={calcTrend(data.trends.newUsers)}
              color="#4F46E5"
              bgColor="#EEF2FF"
              onClick={() => navigateToTab("users")}
            />
            <StatCard
              icon={ImageIcon}
              label="总图片数"
              value={data.overview.totalImages}
              subLabel={data.mediaTypes.map(m => `${m.type === "image" ? "图片" : "视频"} ${m.count}`).join(" / ")}
              trend={calcTrend(data.trends.newImages)}
              color="var(--color-pinterest)"
              bgColor="#FEE2E2"
              onClick={() => navigateToTab("images")}
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
            <StatCard
              icon={Eye}
              label="总浏览量"
              value={data.overview.totalViews}
              color="#7C3AED"
              bgColor="#F5F3FF"
            />
          </div>

          {/* 运营告警卡片 - 第二行 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={ShieldAlert}
              label="待审核图片"
              value={data.overview.pendingReview}
              color="#DC2626"
              bgColor="#FEE2E2"
              urgent={data.overview.pendingReview > 0}
              onClick={() => navigateToTab("review")}
            />
            <StatCard
              icon={AlertTriangle}
              label="待处理举报"
              value={data.overview.openReports}
              color="#D97706"
              bgColor="#FEF3C7"
              urgent={data.overview.openReports > 0}
              onClick={() => navigateToTab("reports")}
            />
            <StatCard
              icon={MessageSquare}
              label={`近${days}日评论`}
              value={data.overview.recentComments}
              color="#0891B2"
              bgColor="#ECFEFF"
            />
            <StatCard
              icon={AlertTriangle}
              label="NSFW标记"
              value={data.overview.nsfwFlagged}
              color="#DC2626"
              bgColor="#FEE2E2"
              urgent={data.overview.nsfwFlagged > 0}
            />
          </div>

          {/* 趋势图表 - 上传 & 下载 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[var(--color-pinterest)]" />
                  上传趋势
                </CardTitle>
                <CardDescription>近{days}天每日新增上传</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={data.trends.newImages}
                  label="新增图片"
                  color="var(--color-pinterest)"
                  type={chartType}
                />
              </CardContent>
            </Card>

            <Card className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#059669]" />
                  下载趋势
                </CardTitle>
                <CardDescription>近{days}天每日下载量</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={data.trends.downloads}
                  label="下载数"
                  color="#059669"
                  type={chartType}
                />
              </CardContent>
            </Card>
          </div>

          {/* 用户注册趋势 + 分类分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4F46E5]" />
                  用户注册趋势
                </CardTitle>
                <CardDescription>近{days}天每日新增注册用户</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={data.trends.newUsers}
                  label="新增用户"
                  color="#4F46E5"
                  type={chartType}
                />
              </CardContent>
            </Card>

            <Card
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigateToTab("categories")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#D97706]" />
                  分类分布
                  <ChevronRight className="w-4 h-4 text-[var(--color-ash)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </CardTitle>
                <CardDescription>各分类壁纸数量统计 · 点击管理</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[280px] overflow-y-auto">
                <CategoryChart data={data.categoryDistribution} />
              </CardContent>
            </Card>
          </div>

          {/* 壁纸平台专业指标 - 媒体类型 + 分辨率 + 存储 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#4F46E5]" />
                  媒体类型分布
                </CardTitle>
                <CardDescription>图片 vs 视频占比</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart
                  segments={data.mediaTypes.map((m) => ({
                    label: m.type === "image" ? "图片" : m.type === "video" ? "视频" : m.type,
                    value: m.count,
                    color: MEDIA_TYPE_COLORS[m.type] || "#6B7280",
                  }))}
                  total={data.mediaTypes.reduce((s, m) => s + m.count, 0)}
                />
              </CardContent>
            </Card>

            <Card className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-[#7C3AED]" />
                  分辨率分布
                </CardTitle>
                <CardDescription>各分辨率壁纸占比</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart
                  segments={data.resolutions.map((r) => ({
                    label: r.resolution,
                    value: r.count,
                    color: RESOLUTION_COLORS[r.resolution] || "#6B7280",
                  }))}
                  total={data.resolutions.reduce((s, r) => s + r.count, 0)}
                />
              </CardContent>
            </Card>

            <Card className="group hover:shadow-md transition-shadow">
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

          {/* 热门壁纸 + 热门创作者 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigateToTab("images")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-[var(--color-pinterest)]" />
                  热门壁纸 Top 10
                  <ChevronRight className="w-4 h-4 text-[var(--color-ash)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </CardTitle>
                <CardDescription>下载量排行 · 点击查看全部</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-y-auto">
                <TopImagesList data={data.topImages} />
              </CardContent>
            </Card>

            <Card
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigateToTab("users")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  热门创作者 Top 10
                  <ChevronRight className="w-4 h-4 text-[var(--color-ash)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </CardTitle>
                <CardDescription>下载量排行 · 点击查看全部</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-y-auto">
                <TopCreatorsList data={data.topCreators} />
              </CardContent>
            </Card>
          </div>

          {/* 快捷操作 + 近期注册用户 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <QuickActions
              pendingReview={data.overview.pendingReview}
              openReports={data.overview.openReports}
              onNavigate={navigateToTab}
            />

            <Card
              className="group hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigateToTab("users")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4F46E5]" />
                  近期注册用户
                  <ChevronRight className="w-4 h-4 text-[var(--color-ash)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                </CardTitle>
                <CardDescription>最近注册的5位用户 · 点击查看全部</CardDescription>
              </CardHeader>
              <CardContent>
                <RecentUsersList data={data.recentUsers} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}