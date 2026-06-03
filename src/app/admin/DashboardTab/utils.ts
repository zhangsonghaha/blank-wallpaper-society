import type { TrendPoint } from "./types";

export const formatNumber = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
};

export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
};

export const calcTrend = (trend: TrendPoint[]): number => {
  if (trend.length < 7) return 0;
  const mid = Math.floor(trend.length / 2);
  const firstHalf = trend.slice(0, mid).reduce((s, d) => s + d.count, 0);
  const secondHalf = trend.slice(mid).reduce((s, d) => s + d.count, 0);
  if (firstHalf === 0) return secondHalf > 0 ? 100 : 0;
  return ((secondHalf - firstHalf) / firstHalf) * 100;
};
