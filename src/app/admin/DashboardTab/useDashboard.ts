"use client";

import { useState, useEffect, useCallback } from "react";
import type { StatsData } from "./types";

export function useDashboard() {
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

  return {
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
  };
}
