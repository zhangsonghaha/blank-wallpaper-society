"use client";

import {
  Users,
  Image as ImageIcon,
  Download,
  Heart,
  Eye,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Video,
  Monitor,
  HardDrive,
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

import { RESOLUTION_COLORS, MEDIA_TYPE_COLORS } from "./constants";
import { calcTrend } from "./utils";
import { useDashboard } from "./useDashboard";
import StatCard from "./StatCard";
import TrendChart from "./TrendChart";
import CategoryChart from "./CategoryChart";
import DonutChart from "./DonutChart";
import TopImagesList from "./TopImagesList";
import TopCreatorsList from "./TopCreatorsList";
import StorageOverview from "./StorageOverview";
import QuickActions from "./QuickActions";
import RecentUsersList from "./RecentUsersList";

export default function DashboardTab() {
  const {
    data,
    loading,
    error,
    days,
    setDays,
    chartType,
    setChartType,
    refreshing,
    lastUpdated,
    autoRefresh,
    setAutoRefresh,
    countdown,
    ripple,
    fetchStats,
    handleRipple,
    navigateToTab,
  } = useDashboard();

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
                    ? "bg-[var(--color-surface-card)] text-[var(--color-ink)] shadow-sm"
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
                  ? "bg-[var(--color-surface-card)] text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ash)] hover:text-[var(--color-ink)]"
              }`}
            >
              柱状
            </button>
            <button
              onClick={(e) => { handleRipple(e); setChartType("line"); }}
              className={`relative overflow-hidden px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                chartType === "line"
                  ? "bg-[var(--color-surface-card)] text-[var(--color-ink)] shadow-sm"
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
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-[var(--color-surface-card)] shadow-lg rounded-lg px-4 py-2 border">
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
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
                  <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
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
                  <Video className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
                  <Monitor className="w-4 h-4 text-violet-600 dark:text-violet-400" />
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
                  <HardDrive className="w-4 h-4 text-violet-600 dark:text-violet-400" />
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
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
