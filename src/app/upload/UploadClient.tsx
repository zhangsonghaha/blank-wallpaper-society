"use client";

import { useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Tag,
  FolderOpen,
  FileText,
  Info,
  Sparkles,
  Camera,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const CATEGORIES = [
  { value: "nature", label: "自然风光" },
  { value: "city", label: "城市建筑" },
  { value: "portrait", label: "人像摄影" },
  { value: "food", label: "美食" },
  { value: "travel", label: "旅行" },
  { value: "art", label: "艺术" },
  { value: "animals", label: "动物" },
  { value: "minimal", label: "极简" },
];

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB 图片
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024; // 50MB 视频
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1080;
const DAILY_LIMIT = 10;

interface ExifData {
  camera?: string;
  lens?: string;
  focalLength?: number;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  dateTaken?: string;
  gps?: { lat: number; lng: number };
  orientation?: number;
  software?: string;
}

interface SmartFillResult {
  suggestedTitle: string;
  suggestedTags: string[];
  suggestedCategory: string;
  exif: ExifData;
  dominantColor: string;
  colorPalette: string[];
}

interface PreviewFile {
  file: File;
  preview: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  valid: boolean;
  error?: string;
  // 智能填充相关
  smartFillLoading: boolean;
  smartFilled: boolean;
  suggestedTags: string[];
  exif: ExifData | null;
  dominantColor: string;
  colorPalette: string[];
}

export default function UploadClient() {
  const { data: session } = useSession();
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState<
    { title: string; status: string; message: string; imageStatus?: string }[]
  >([]);
  const [todayCount, setTodayCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = (session?.user as any)?.role === "admin";

  // 获取今日上传数量
  useState(() => {
    fetch("/api/user/uploads?limit=1")
      .then((res) => res.json())
      .then((data) => {
        setTodayCount(data.todayCount || 0);
      })
      .catch(() => {});
  });

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: "不支持的文件类型，仅支持 JPEG、PNG、WebP、MP4、WebM" };
    }
    const maxSize = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
    const maxSizeMB = isVideo ? 50 : 10;
    if (file.size > maxSize) {
      return { valid: false, error: `文件大小超过${maxSizeMB}MB限制` };
    }
    return { valid: true };
  };

  // 智能填充单个文件
  const smartFillFile = useCallback(async (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], smartFillLoading: true };
      return newFiles;
    });

    try {
      const fileItem = files[index];
      const formData = new FormData();
      formData.append("file", fileItem.file);
      if (fileItem.category) {
        formData.append("category", fileItem.category);
      }

      const res = await fetch("/api/upload/smart-fill", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("智能填充请求失败");
      }

      const data: SmartFillResult = await res.json();

      setFiles((prev) => {
        const newFiles = [...prev];
        const current = newFiles[index];

        // 更新表单字段（仅当用户未手动修改时才填充）
        const updatedTags = current.tags
          ? current.tags
          : data.suggestedTags.join(",");

        newFiles[index] = {
          ...current,
          title: current.title === current.file.name.replace(/\.[^.]+$/, "") 
            ? (data.suggestedTitle || current.title)
            : current.title,
          category: current.category || data.suggestedCategory || current.category,
          tags: updatedTags,
          smartFillLoading: false,
          smartFilled: true,
          suggestedTags: data.suggestedTags,
          exif: data.exif,
          dominantColor: data.dominantColor,
          colorPalette: data.colorPalette,
        };
        return newFiles;
      });

      toast.success("智能填充完成");
    } catch (err) {
      setFiles((prev) => {
        const newFiles = [...prev];
        newFiles[index] = { ...newFiles[index], smartFillLoading: false };
        return newFiles;
      });
      toast.error("智能填充失败");
    }
  }, [files]);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const remaining = DAILY_LIMIT - todayCount - files.length;
      if (!isAdmin && remaining <= 0) {
        toast.error(`今日上传已达上限(${DAILY_LIMIT}张)`);
        return;
      }
      const allowedCount = isAdmin ? fileArray.length : Math.min(fileArray.length, remaining);
      const toAdd = fileArray.slice(0, allowedCount);

      if (toAdd.length < fileArray.length) {
        toast.warning(`今日剩余上传额度不足，仅添加了${toAdd.length}张`);
      }

      const newPreviewFiles: PreviewFile[] = toAdd.map((file) => {
        const validation = validateFile(file);
        return {
          file,
          preview: URL.createObjectURL(file),
          title: file.name.replace(/\.[^.]+$/, ""),
          description: "",
          category: "",
          tags: "",
          valid: validation.valid,
          error: validation.error,
          smartFillLoading: false,
          smartFilled: false,
          suggestedTags: [],
          exif: null,
          dominantColor: "",
          colorPalette: [],
        };
      });

      setFiles((prev) => [...prev, ...newPreviewFiles]);

      // 自动为每个文件执行智能填充
      newPreviewFiles.forEach((_, i) => {
        const globalIndex = files.length + i;
        setTimeout(() => {
          autoSmartFill(globalIndex, newPreviewFiles[i].file, newPreviewFiles[i].category);
        }, 100 * i); // 错开请求，避免并发过多
      });
    },
    [todayCount, files.length, isAdmin]
  );

  // 自动智能填充（不显示 toast）
  const autoSmartFill = useCallback(async (index: number, file: File, currentCategory: string) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index]) {
        newFiles[index] = { ...newFiles[index], smartFillLoading: true };
      }
      return newFiles;
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (currentCategory) {
        formData.append("category", currentCategory);
      }

      const res = await fetch("/api/upload/smart-fill", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("smart fill failed");

      const data: SmartFillResult = await res.json();

      setFiles((prev) => {
        const newFiles = [...prev];
        const current = newFiles[index];
        if (!current) return prev;

        const defaultTitle = current.file.name.replace(/\.[^.]+$/, "");
        newFiles[index] = {
          ...current,
          title: current.title === defaultTitle 
            ? (data.suggestedTitle || current.title)
            : current.title,
          category: current.category || data.suggestedCategory || current.category,
          tags: data.suggestedTags.join(","),
          smartFillLoading: false,
          smartFilled: true,
          suggestedTags: data.suggestedTags,
          exif: data.exif,
          dominantColor: data.dominantColor,
          colorPalette: data.colorPalette,
        };
        return newFiles;
      });
    } catch {
      setFiles((prev) => {
        const newFiles = [...prev];
        if (newFiles[index]) {
          newFiles[index] = { ...newFiles[index], smartFillLoading: false };
        }
        return newFiles;
      });
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const updateFile = (index: number, field: keyof PreviewFile, value: string | null) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], [field]: value ?? "" };
      return newFiles;
    });
  };

  // 添加推荐标签
  const addSuggestedTag = (index: number, tag: string) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const current = newFiles[index];
      const existingTags = current.tags
        ? current.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      if (existingTags.includes(tag)) return prev;
      existingTags.push(tag);
      newFiles[index] = { ...current, tags: existingTags.join(",") };
      return newFiles;
    });
  };

  // 移除推荐标签
  const removeTag = (index: number, tag: string) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const current = newFiles[index];
      const existingTags = current.tags
        ? current.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const filtered = existingTags.filter((t) => t !== tag);
      newFiles[index] = { ...current, tags: filtered.join(",") };
      return newFiles;
    });
  };

  // 批量设置所有文件的分类和标签
  const applyBatchSettings = useCallback((category: string, tags: string) => {
    setFiles((prev) =>
      prev.map((f) => ({
        ...f,
        category: category || f.category,
        tags: tags || f.tags,
      }))
    );
    toast.success(`已批量应用设置到 ${files.length} 张图片`);
  }, [files.length]);

  const handleUpload = async () => {
    const validFiles = files.filter((f) => f.valid);
    if (validFiles.length === 0) {
      toast.error("没有可上传的文件");
      return;
    }

    setUploading(true);
    setUploadResults([]);
    setUploadProgress({ current: 0, total: validFiles.length });
    const results: { title: string; status: string; message: string; imageStatus?: string }[] = [];

    for (let i = 0; i < validFiles.length; i++) {
      const fileItem = validFiles[i];
      setUploadProgress({ current: i, total: validFiles.length });
      try {
        const formData = new FormData();
        formData.append("file", fileItem.file);
        formData.append("title", fileItem.title);
        formData.append("description", fileItem.description);
        formData.append("category", fileItem.category);
        formData.append("tags", fileItem.tags);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (res.ok) {
          results.push({
            title: fileItem.title,
            status: "success",
            message: data.message,
            imageStatus: data.status, // approved / pending / rejected
          });
        } else if (res.status === 409 && data.duplicate) {
          results.push({
            title: fileItem.title,
            status: "duplicate",
            message: `与「${data.duplicate.title || "ID:" + data.duplicate.id}」相似度超过95%，已阻止上传`,
          });
        } else {
          results.push({
            title: fileItem.title,
            status: "error",
            message: data.message || data.error || "上传失败",
          });
        }
      } catch (err) {
        results.push({
          title: fileItem.title,
          status: "error",
          message: "网络错误",
        });
      }
    }

    setUploadProgress({ current: validFiles.length, total: validFiles.length });
    setUploadResults(results);
    setUploading(false);

    const successCount = results.filter((r) => r.status === "success").length;
    if (successCount > 0) {
      toast.success(`成功上传 ${successCount} 张图片`);
      setTodayCount((prev) => prev + successCount);
      // 移除已成功上传的文件
      setFiles((prev) => {
        const remaining = prev.filter((f) => !f.valid);
        return remaining;
      });
    }
  };

  const remainingQuota = isAdmin ? Infinity : DAILY_LIMIT - todayCount;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      <Toaster position="top-right" richColors />

      <div className="max-w-[960px] mx-auto px-4 lg:px-8 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-[var(--color-ink)] mb-2">上传壁纸</h1>
          <p className="text-[var(--color-mute)]">
            分享你的高清壁纸，让更多人欣赏你的作品
          </p>
        </motion.div>

        {/* Upload Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="rounded-xl border-none bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">上传须知</p>
                <ul className="text-blue-600 dark:text-blue-300 space-y-0.5 list-disc list-inside">
                  <li>支持格式：JPEG、PNG、WebP、MP4、WebM（动态壁纸）</li>
                  <li>文件大小：图片最大10MB，视频最大50MB</li>
                  <li>分辨率要求：图片最低 1920x1080</li>
                  {!isAdmin && (
                    <li>
                      每日限额：{todayCount}/{DAILY_LIMIT} 张（今日已用/总额）
                    </li>
                  )}
                  <li>非管理员上传的壁纸需经审核后才会公开显示</li>
                  <li>上传后将自动智能填充标题、标签和分类</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Drag & Drop Zone */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-12
              transition-all duration-200 text-center
              ${
                isDragging
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 scale-[1.01]"
                  : "border-[var(--color-hairline)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-card)]"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
            <div className="flex flex-col items-center gap-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                  isDragging
                    ? "bg-[var(--color-primary)]/10"
                    : "bg-[var(--color-surface-card)]"
                }`}
              >
                <Upload
                  className={`w-8 h-8 transition-colors ${
                    isDragging
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-ash)]"
                  }`}
                />
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--color-ink)] mb-1">
                  {isDragging ? "松开以上传文件" : "拖拽图片到此处，或点击选择文件"}
                </p>
                <p className="text-sm text-[var(--color-mute)]">
                  支持 JPEG、PNG、WebP，单文件最大10MB，最低分辨率 1920x1080
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Batch Settings & Progress */}
        {files.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Card className="rounded-xl border-[var(--color-hairline)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  批量设置
                  <Badge variant="outline" className="text-xs font-normal">
                    应用到全部 {files.length} 张
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-[var(--color-mute)]">统一分类</Label>
                    <Select onValueChange={(v: any) => applyBatchSettings(String(v), "")}>
                      <SelectTrigger className="mt-1 rounded-lg h-9 text-sm">
                        <SelectValue placeholder="选择分类..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-[var(--color-mute)]">统一标签（逗号分隔）</Label>
                    <Input
                      className="mt-1 rounded-lg h-9 text-sm"
                      placeholder="自然,风光,旅行"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          applyBatchSettings("", (e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9"
                    onClick={() => {
                      const tagsInput = document.querySelector('input[placeholder="自然,风光,旅行"]') as HTMLInputElement;
                      applyBatchSettings("", tagsInput?.value || "");
                    }}
                  >
                    应用标签
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--color-ink)]">
                    正在上传 {uploadProgress.current + 1} / {uploadProgress.total}
                  </span>
                  <span className="text-[var(--color-mute)]">
                    {Math.round(((uploadProgress.current) / uploadProgress.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-[var(--color-surface-card)] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--color-primary)] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* File Previews */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 space-y-4"
            >
              {files.map((fileItem, index) => (
                <motion.div
                  key={fileItem.preview}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`rounded-xl overflow-hidden ${
                      fileItem.valid
                        ? "border-[var(--color-hairline)]"
                        : "border-red-300 bg-red-50/50"
                    }`}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        {/* Image Preview */}
                        <div className="relative w-full md:w-48 h-48 shrink-0 bg-[var(--color-surface-card)]">
                          <img
                            src={fileItem.preview}
                            alt={fileItem.title}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(index);
                            }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                          {!fileItem.valid && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                              <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>
                          )}
                          {/* Smart fill loading overlay */}
                          {fileItem.smartFillLoading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                                <span className="text-xs text-white">智能分析中...</span>
                              </div>
                            </div>
                          )}
                          {/* Dominant color indicator */}
                          {fileItem.dominantColor && !fileItem.smartFillLoading && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1">
                              <div
                                className="w-4 h-4 rounded-full border border-white/50 shadow-sm"
                                style={{ backgroundColor: fileItem.dominantColor }}
                              />
                              <span className="text-[10px] text-white font-medium drop-shadow-sm">
                                {fileItem.dominantColor}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Form Fields */}
                        <div className="flex-1 p-4 space-y-3">
                          {fileItem.error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm">
                              <AlertCircle className="w-4 h-4" />
                              {fileItem.error}
                            </div>
                          )}

                          {/* Smart fill button */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => smartFillFile(index)}
                              disabled={fileItem.smartFillLoading}
                              className="rounded-full text-xs h-7 gap-1 border-[var(--color-primary)]/30 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                            >
                              {fileItem.smartFillLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              智能填充
                            </Button>
                            {fileItem.smartFilled && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                已自动填充
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-[var(--color-mute)]">
                                标题 *
                              </Label>
                              <Input
                                value={fileItem.title}
                                onChange={(e) =>
                                  updateFile(index, "title", e.target.value)
                                }
                                placeholder="输入壁纸标题"
                                className="mt-1 rounded-lg h-9 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-[var(--color-mute)]">
                                <FolderOpen className="w-3 h-3 inline mr-1" />
                                分类
                              </Label>
                              <Select
                                value={fileItem.category || ""}
                                onValueChange={(val) =>
                                  updateFile(index, "category", val)
                                }
                              >
                                <SelectTrigger className="mt-1 rounded-lg h-9 text-sm">
                                  <SelectValue placeholder="选择分类" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                      {cat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* EXIF info */}
                          {fileItem.exif && (fileItem.exif.camera || fileItem.exif.lens || fileItem.exif.focalLength) && (
                            <div className="flex items-center gap-2 text-xs text-[var(--color-mute)] bg-[var(--color-surface-card)] px-3 py-2 rounded-lg">
                              <Camera className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                {[
                                  fileItem.exif.camera,
                                  fileItem.exif.lens,
                                  fileItem.exif.focalLength && `${fileItem.exif.focalLength}mm`,
                                  fileItem.exif.aperture && `f/${fileItem.exif.aperture}`,
                                  fileItem.exif.shutterSpeed,
                                  fileItem.exif.iso && `ISO ${fileItem.exif.iso}`,
                                ].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          )}

                          <div>
                            <Label className="text-xs text-[var(--color-mute)]">
                              描述
                            </Label>
                            <Textarea
                              value={fileItem.description}
                              onChange={(e) =>
                                updateFile(index, "description", e.target.value)
                              }
                              placeholder="简短描述你的壁纸..."
                              className="mt-1 rounded-lg text-sm min-h-[60px] resize-none"
                              rows={2}
                            />
                          </div>

                          {/* Tags as chips */}
                          <div>
                            <Label className="text-xs text-[var(--color-mute)]">
                              <Tag className="w-3 h-3 inline mr-1" />
                              标签
                            </Label>
                            {/* Current tags as chips */}
                            <div className="flex flex-wrap gap-1.5 mt-1.5 mb-2">
                              {fileItem.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="secondary"
                                  className="rounded-full text-xs pr-1 gap-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                >
                                  {tag}
                                  <button
                                    onClick={() => removeTag(index, tag)}
                                    className="w-4 h-4 rounded-full hover:bg-[var(--color-primary)]/20 flex items-center justify-center"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                            <Input
                              value={fileItem.tags}
                              onChange={(e) =>
                                updateFile(index, "tags", e.target.value)
                              }
                              placeholder="输入标签，用逗号分隔"
                              className="rounded-lg h-9 text-sm"
                            />
                            {/* Suggested tags */}
                            {fileItem.suggestedTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="text-[10px] text-[var(--color-ash)] mr-1">推荐：</span>
                                {fileItem.suggestedTags
                                  .filter((st) => !fileItem.tags.split(",").map((t) => t.trim()).includes(st))
                                  .map((tag) => (
                                    <button
                                      key={tag}
                                      onClick={() => addSuggestedTag(index, tag)}
                                      className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border border-dashed border-[var(--color-hairline)] text-[var(--color-mute)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                      {tag}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>

                          {/* Color palette */}
                          {fileItem.colorPalette.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-[var(--color-ash)]">色板：</span>
                              <div className="flex gap-1">
                                {fileItem.colorPalette.map((color, i) => (
                                  <div
                                    key={i}
                                    className="w-5 h-5 rounded-full border border-[var(--color-hairline)] shadow-sm"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {/* Upload Button */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-[var(--color-mute)]">
                  {files.filter((f) => f.valid).length} 个有效文件待上传
                  {!isAdmin && ` · 今日剩余额度: ${Math.max(0, remainingQuota - files.filter((f) => f.valid).length)}`}
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      files.forEach((f) => URL.revokeObjectURL(f.preview));
                      setFiles([]);
                    }}
                    className="rounded-full"
                    disabled={uploading}
                  >
                    清空
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || files.filter((f) => f.valid).length === 0}
                    className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-2 min-w-[120px]"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        上传
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Results */}
        <AnimatePresence>
          {uploadResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6"
            >
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">上传结果</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {uploadResults.map((result, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--color-surface-card)]"
                    >
                      {result.status === "success" ? (
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                      ) : result.status === "duplicate" ? (
                        <AlertCircle className="w-5 h-5 text-orange-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                          {result.title}
                        </p>
                        <p
                          className={`text-xs ${
                            result.status === "success"
                              ? "text-green-600"
                              : result.status === "duplicate"
                              ? "text-orange-600"
                              : "text-red-500"
                          }`}
                        >
                          {result.message}
                        </p>
                      </div>
                      {result.status === "success" && (
                        result.imageStatus === "approved" ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-green-600 border-green-300 bg-green-50"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            已通过
                          </Badge>
                        ) : result.imageStatus === "rejected" ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-red-600 border-red-300 bg-red-50"
                          >
                            <AlertCircle className="w-3 h-3 mr-1" />
                            已拒绝
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-yellow-600 border-yellow-300 bg-yellow-50"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            待审核
                          </Badge>
                        )
                      )}
                      {result.status === "duplicate" && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-orange-600 border-orange-300 bg-orange-50"
                        >
                          重复
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Uploads Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <Link
            href="/profile"
            className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            查看我的上传历史 →
          </Link>
        </motion.div>
      </div>
    </div>
  );
}