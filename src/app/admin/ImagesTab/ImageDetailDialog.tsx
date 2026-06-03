"use client";

import {
  Heart,
  Eye,
  Tag,
  FolderOpen,
  Calendar,
  Image as ImageIcon,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ImageRecord, Category } from "./types";
import { formatSize, formatDate, getCategoryLabel } from "./utils";

interface ImageDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: ImageRecord | null;
  categories: Category[];
  onToggleFavorite: (image: ImageRecord) => void;
  onOpenEdit: (image: ImageRecord) => void;
  onDelete: (image: ImageRecord) => void;
}

export default function ImageDetailDialog({
  open,
  onOpenChange,
  image,
  categories,
  onToggleFavorite,
  onOpenEdit,
  onDelete,
}: ImageDetailDialogProps) {
  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative rounded-xl overflow-hidden bg-[var(--color-surface-card)] -mx-6 -mt-6 mb-4">
          <img
            src={image.url}
            alt={image.title}
            className="w-full max-h-[50vh] object-contain"
          />
          {image.is_favorite && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-red-500 gap-1 rounded-full">
                <Heart className="w-3 h-3 fill-white" />
                已收藏
              </Badge>
            </div>
          )}
        </div>
        <DialogHeader>
          <DialogTitle className="text-xl">{image.title}</DialogTitle>
          {image.description && (
            <p className="text-sm text-[var(--color-mute)] mt-1">{image.description}</p>
          )}
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
              <Tag className="w-3 h-3" /> 作者
            </p>
            <p className="text-sm font-medium">{image.author || "未知"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
              <FolderOpen className="w-3 h-3" /> 分类
            </p>
            <p className="text-sm font-medium">
              {image.category ? getCategoryLabel(image.category, categories) : "未分类"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> 尺寸
            </p>
            <p className="text-sm font-medium">{image.width} × {image.height}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-mute)]">文件大小</p>
            <p className="text-sm font-medium">{formatSize(image.file_size)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
              <Eye className="w-3 h-3" /> 浏览
            </p>
            <p className="text-sm font-medium">{image.view_count} 次</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 上传时间
            </p>
            <p className="text-sm font-medium">{formatDate(image.created_at)}</p>
          </div>
        </div>
        {image.tags && (
          <div className="pb-4">
            <p className="text-xs text-[var(--color-mute)] mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" /> 标签
            </p>
            <div className="flex flex-wrap gap-1.5">
              {image.tags.split(",").map((tag, i) => (
                <Badge key={i} variant="secondary" className="rounded-full text-xs">
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <Separator />
        <div className="flex items-center gap-3 pt-4">
          <Button variant="outline" className="rounded-full gap-2" onClick={() => onToggleFavorite(image)}>
            <Heart className={`w-4 h-4 ${image.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
            {image.is_favorite ? "取消收藏" : "收藏"}
          </Button>
          <Button variant="outline" className="rounded-full gap-2" onClick={() => {
            onOpenEdit(image);
            onOpenChange(false);
          }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            编辑
          </Button>
          <Button variant="outline" className="rounded-full gap-2" onClick={() => window.open(image.url, "_blank")}>
            <Download className="w-4 h-4" />
            查看原图
          </Button>
          <Button variant="destructive" className="rounded-full gap-2 ml-auto" onClick={() => onDelete(image)}>
            <Trash2 className="w-4 h-4" />
            删除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
