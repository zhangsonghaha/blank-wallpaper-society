"use client";

import { Search, Copy, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardTitle, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "./types";

interface ImageListToolbarProps {
  activeTab: "list" | "duplicates";
  setActiveTab: (tab: "list" | "duplicates") => void;
  onLoadDuplicates: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  categories: Category[];
  variantGenerating: boolean;
  onGenerateVariants: () => void;
  onSetPage: (p: number) => void;
}

export default function ImageListToolbar({
  activeTab,
  setActiveTab,
  onLoadDuplicates,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  categories,
  variantGenerating,
  onGenerateVariants,
  onSetPage,
}: ImageListToolbarProps) {
  return (
    <CardHeader className="pb-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardTitle>图片管理</CardTitle>
          <div className="flex items-center bg-[var(--color-surface-soft)] rounded-full p-0.5">
            <button
              onClick={() => setActiveTab("list")}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                activeTab === "list"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-mute)] hover:text-foreground"
              }`}
            >
              图片列表
            </button>
            <button
              onClick={() => {
                setActiveTab("duplicates");
                onLoadDuplicates();
              }}
              className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                activeTab === "duplicates"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-mute)] hover:text-foreground"
              }`}
            >
              <Copy className="w-3 h-3" />
              重复检测
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
            <Input
              placeholder="搜索图片..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSetPage(1);
              }}
              className="pl-9 h-9 rounded-full text-sm"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              if (v) setCategoryFilter(v);
              onSetPage(1);
            }}
          >
            <SelectTrigger className="w-32 h-9 rounded-full text-sm">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.slug}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-9 gap-1.5 shrink-0"
            disabled={variantGenerating}
            onClick={onGenerateVariants}
            title="为未生成变体的图片批量生成多分辨率变体"
          >
            <Layers className="w-3.5 h-3.5" />
            {variantGenerating ? "生成中..." : "生成变体"}
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}
