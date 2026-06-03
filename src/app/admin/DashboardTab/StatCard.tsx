"use client";

import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "./utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  subLabel?: string;
  trend?: number;
  color: string;
  bgColor: string;
  onClick?: () => void;
  urgent?: boolean;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  trend,
  color,
  bgColor,
  onClick,
  urgent,
}: StatCardProps) {
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
