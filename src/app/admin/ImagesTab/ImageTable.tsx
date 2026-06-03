"use client";

import {
  Eye,
  Trash2,
  ZoomIn,
  Pencil,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImageRecord, Category, PaidImageInfo } from "./types";
import { formatSize, formatDate, getCategoryLabel } from "./utils";

interface ImageTableProps {
  images: ImageRecord[];
  categories: Category[];
  loading: boolean;
  selectedIds: Set<number>;
  allChecked: boolean;
  someChecked: boolean;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  jumpPage: string;
  paidImagesMap: Record<number, PaidImageInfo>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onSetPage: (p: number) => void;
  onSetPageSize: (size: number) => void;
  onSetJumpPage: (v: string) => void;
  onSetSelectedIds: (ids: Set<number>) => void;
  onSetBatchDeleteConfirmOpen: (open: boolean) => void;
  onOpenDetail: (image: ImageRecord) => void;
  onOpenEdit: (image: ImageRecord) => void;
  onDelete: (image: ImageRecord) => void;
  onOpenPaidDialog: (image: ImageRecord | null) => void;
  onUnsetPaid: (imageId: number) => void;
  onSetUploadOpen: (open: boolean) => void;
}

export default function ImageTable({
  images,
  categories,
  loading,
  selectedIds,
  allChecked,
  someChecked,
  page,
  totalPages,
  total,
  pageSize,
  jumpPage,
  paidImagesMap,
  onToggleSelect,
  onToggleSelectAll,
  onSetPage,
  onSetPageSize,
  onSetJumpPage,
  onSetSelectedIds,
  onSetBatchDeleteConfirmOpen,
  onOpenDetail,
  onOpenEdit,
  onDelete,
  onOpenPaidDialog,
  onUnsetPaid,
  onSetUploadOpen,
}: ImageTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-[var(--color-ash)]" />
        </div>
        <h3 className="text-lg font-semibold mb-1">还没有图片</h3>
        <p className="text-sm text-[var(--color-mute)] mb-4">
          点击右上角"上传图片"按钮开始
        </p>
        <Button
          onClick={() => onSetUploadOpen(true)}
          variant="outline"
          className="rounded-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          上传第一张图片
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-blue-50 rounded-xl border border-blue-200">
          <span className="text-sm font-medium text-blue-700">
            已选择 {selectedIds.size} 项
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7"
            onClick={() => onSetSelectedIds(new Set())}
          >
            取消选择
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="rounded-full text-xs h-7 gap-1"
            onClick={() => onSetBatchDeleteConfirmOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            批量删除
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs h-7 gap-1 border-amber-300 text-amber-600 hover:bg-amber-50"
            onClick={() => onOpenPaidDialog(null)}
          >
            <DollarSign className="w-3.5 h-3.5" />
            批量设为付费
          </Button>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px] pl-4">
                <Checkbox
                  checked={someChecked ? "indeterminate" : allChecked}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[260px]">图片</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>尺寸</TableHead>
              <TableHead>大小</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> 浏览
                </div>
              </TableHead>
              <TableHead>上传时间</TableHead>
              <TableHead className="w-[140px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {images.map((image) => (
              <TableRow
                key={image.id}
                className={`cursor-pointer hover:bg-[var(--color-surface-soft)] ${selectedIds.has(image.id) ? "bg-blue-50/50" : ""}`}
              >
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(image.id)}
                    onCheckedChange={() => onToggleSelect(image.id)}
                  />
                </TableCell>
                <TableCell onClick={() => onOpenDetail(image)}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--color-surface-card)]">
                      <img
                        src={image.thumbnail_url || image.url}
                        alt={image.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[180px]">
                        {image.title}
                      </p>
                      <p className="text-xs text-[var(--color-mute)] truncate max-w-[180px]">
                        {image.author || "未知作者"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={() => onOpenDetail(image)}>
                  {image.category ? (
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {getCategoryLabel(image.category, categories)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-mute)]">未分类</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-[var(--color-mute)]" onClick={() => onOpenDetail(image)}>
                  {image.width}×{image.height}
                </TableCell>
                <TableCell className="text-sm text-[var(--color-mute)]" onClick={() => onOpenDetail(image)}>
                  {formatSize(image.file_size)}
                </TableCell>
                <TableCell onClick={() => onOpenDetail(image)}>
                  <div className="flex items-center gap-1 text-sm text-[var(--color-mute)]">
                    {image.view_count}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-[var(--color-mute)]" onClick={() => onOpenDetail(image)}>
                  {formatDate(image.created_at)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="w-8 h-8" title="查看" onClick={() => onOpenDetail(image)}>
                      <ZoomIn className="w-4 h-4 text-[var(--color-mute)]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" title="编辑" onClick={() => onOpenEdit(image)}>
                      <Pencil className="w-4 h-4 text-[var(--color-mute)]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8" title="删除" onClick={() => onDelete(image)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      title={paidImagesMap[image.id]?.is_paid ? `付费 ¥${paidImagesMap[image.id].price} - 点击取消` : "设为付费壁纸"}
                      onClick={() => {
                        if (paidImagesMap[image.id]?.is_paid) {
                          onUnsetPaid(image.id);
                        } else {
                          onOpenPaidDialog(image);
                        }
                      }}
                    >
                      <DollarSign className={`w-4 h-4 ${paidImagesMap[image.id]?.is_paid ? "text-amber-500" : "text-[var(--color-mute)]"}`} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-3 text-sm text-[var(--color-mute)]">
          <span>共 {total} 张图片</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <span>每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                onSetPageSize(Number(v));
                onSetPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-[70px] rounded-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>条</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="rounded-full h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | string)[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              typeof p === "string" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-sm text-[var(--color-mute)]">...</span>
              ) : (
                <Button
                  key={p}
                  variant={page === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => onSetPage(p)}
                  className={`rounded-full h-8 w-8 p-0 text-xs ${
                    page === p ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)]" : ""
                  }`}
                >
                  {p}
                </Button>
              )
            )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="rounded-full h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--color-mute)]">跳至</span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              className="h-7 w-[52px] rounded-full text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={jumpPage}
              onChange={(e) => onSetJumpPage(e.target.value)}
              placeholder={`${page}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const val = Number(jumpPage);
                  if (val >= 1 && val <= totalPages) {
                    onSetPage(val);
                    onSetJumpPage("");
                  }
                }
              }}
            />
            <span className="text-xs text-[var(--color-mute)]">页</span>
          </div>
        </div>
      </div>
    </>
  );
}
