"use client";

import {
  Eye,
  Heart,
  FolderOpen,
  Image as ImageIcon,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImageStats, VariantStatus } from "./types";

interface StatsCardsProps {
  stats: ImageStats;
  loading: boolean;
  variantStatus: VariantStatus | null;
  variantGenerating: boolean;
  onGenerateVariants: () => void;
}

export default function StatsCards({
  stats,
  loading,
  variantStatus,
  variantGenerating,
  onGenerateVariants,
}: StatsCardsProps) {
  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">图片总数</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalImages}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">总浏览</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalViews}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">收藏</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalFavorites}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-mute)]">分类</p>
              <div className="text-xl font-bold">
                {loading ? <Skeleton className="w-12 h-6" /> : stats.totalCategories}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 变体生成进度 */}
      {variantStatus && variantStatus.withoutVariants > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">变体生成进度</p>
                <p className="text-xs text-amber-600">
                  已生成 {variantStatus.withVariants} / {variantStatus.totalImages} 张图片，
                  剩余 {variantStatus.withoutVariants} 张待处理
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32">
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${variantStatus.progress}%` }}
                  />
                </div>
                <p className="text-xs text-amber-600 text-right mt-1">{variantStatus.progress}%</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                disabled={variantGenerating}
                onClick={onGenerateVariants}
              >
                <Layers className="w-3.5 h-3.5" />
                {variantGenerating ? "生成中..." : "开始生成"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
