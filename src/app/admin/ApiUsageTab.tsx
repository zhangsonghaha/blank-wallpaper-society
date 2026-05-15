"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, Key, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ApiUsageTab() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-usage?action=overview");
      if (res.ok) {
        const data = await res.json();
        setOverview(data.data);
      }
    } catch (err) {
      console.error("获取API用量概览失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHourly = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-usage?action=hourly");
      if (res.ok) {
        const data = await res.json();
        setHourlyData(data.data || []);
      }
    } catch (err) {
      console.error("获取小时数据失败:", err);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchHourly();
  }, [fetchOverview, fetchHourly]);

  const tiers: Record<string, { name: string; rateLimit: number }> = {
    free: { name: "免费版", rateLimit: 100 },
    pro: { name: "专业版", rateLimit: 1000 },
    enterprise: { name: "企业版", rateLimit: -1 },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">API用量统计</h2>
        <Button variant="outline" size="sm" onClick={() => { fetchOverview(); fetchHourly(); }}>
          <RefreshCw className="w-4 h-4 mr-1" /> 刷新
        </Button>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-mute)]">总API Key数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalKeys || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-mute)]">活跃Key数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overview?.activeKeys || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-mute)]">今日调用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{overview?.totalCallsToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-mute)]">7日调用</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{overview?.totalCalls7d || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 套餐分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" /> 套餐分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {(overview?.tierDistribution || []).map((item: any) => (
              <div key={item.tier} className="flex items-center gap-2">
                <Badge variant={item.tier === "enterprise" ? "default" : "secondary"}>
                  {tiers[item.tier]?.name || item.tier}
                </Badge>
                <span className="text-sm text-[var(--color-mute)]">{item.count} 个Key</span>
              </div>
            ))}
            {(overview?.tierDistribution || []).length === 0 && (
              <span className="text-sm text-[var(--color-mute)]">暂无API Key</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 24小时调用量趋势 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> 24小时调用量
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hourlyData.length > 0 ? (
            <div className="space-y-1">
              {hourlyData.map((item: any, idx: number) => {
                const maxCount = Math.max(...hourlyData.map((d: any) => d.count), 1);
                const width = (item.count / maxCount) * 100;
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-[var(--color-mute)] shrink-0">{item.hour?.split(" ")[1] || ""}</span>
                    <div className="flex-1 h-5 bg-[var(--color-surface-card)] rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded transition-all"
                        style={{ width: `${Math.max(width, 2)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-[var(--color-ink)]">{item.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-mute)] text-center py-4">暂无调用数据</p>
          )}
        </CardContent>
      </Card>

      {/* 套餐说明 */}
      <Card>
        <CardHeader>
          <CardTitle>API套餐说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(tiers).map(([key, tier]) => (
              <div key={key} className="p-4 border rounded-lg">
                <h4 className="font-semibold">{tier.name}</h4>
                <p className="text-sm text-[var(--color-mute)] mt-1">
                  {tier.rateLimit === -1 ? "无限调用" : `${tier.rateLimit}次/小时`}
                </p>
                <Badge className="mt-2" variant={key === "free" ? "secondary" : "default"}>
                  {key === "free" ? "免费" : key === "pro" ? "¥29/月" : "¥99/月"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}