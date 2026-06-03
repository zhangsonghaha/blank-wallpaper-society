"use client";

import {
  Activity,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function QuickActions({
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
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative dark:after:absolute dark:after:inset-0 dark:after:rounded-lg dark:after:bg-black/50"
              style={{ backgroundColor: action.bgColor }}
            >
              <action.icon className="w-4.5 h-4.5 relative z-10" style={{ color: action.color }} />
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
