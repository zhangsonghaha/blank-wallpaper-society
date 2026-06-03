"use client";

import {
  Upload,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Category, UploadForm } from "./types";

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadMode: "file" | "url";
  setUploadMode: (mode: "file" | "url") => void;
  uploadForm: UploadForm;
  setUploadForm: React.Dispatch<React.SetStateAction<UploadForm>>;
  previewUrl: string;
  uploading: boolean;
  categories: Category[];
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlPreview: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ImageUploadDialog({
  open,
  onOpenChange,
  uploadMode,
  setUploadMode,
  uploadForm,
  setUploadForm,
  previewUrl,
  uploading,
  categories,
  onFileSelect,
  onUrlPreview,
  onSubmit,
}: ImageUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">上传图片</DialogTitle>
          <DialogDescription>
            支持本地文件或网络链接，JPG/PNG/WebP/GIF 格式，单文件最大 20MB
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant={uploadMode === "file" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setUploadMode("file");
              setUploadForm((prev) => ({ ...prev, file: null, url: "" }));
            }}
            className="rounded-full gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            本地上传
          </Button>
          <Button
            type="button"
            variant={uploadMode === "url" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setUploadMode("url");
              setUploadForm((prev) => ({ ...prev, file: null, url: "" }));
            }}
            className="rounded-full gap-1"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            网络链接
          </Button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div>
              <Label className="mb-2 block">
                {uploadMode === "file" ? "选择图片 *" : "图片链接 *"}
              </Label>
              {uploadMode === "file" ? (
                <div
                  className="border-2 border-dashed border-[var(--color-hairline)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                  onClick={() => document.getElementById("upload-file-img")?.click()}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="预览"
                      className="max-h-40 mx-auto rounded-lg object-contain"
                    />
                  ) : (
                    <div className="text-[var(--color-mute)]">
                      <Upload className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-sm">点击选择图片</p>
                      <p className="text-xs mt-1">或拖拽文件到此处</p>
                    </div>
                  )}
                  <input
                    id="upload-file-img"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFileSelect}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      value={uploadForm.url}
                      onChange={(e) => setUploadForm((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://example.com/image.jpg"
                      className="pr-10 h-10"
                    />
                    <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onUrlPreview}
                    disabled={!uploadForm.url}
                    className="rounded-full w-full"
                  >
                    预览图片
                  </Button>
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="预览"
                      className="max-h-40 mx-auto rounded-lg object-contain border"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="img-title">标题</Label>
                <Input
                  id="img-title"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="图片标题"
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="img-desc">描述</Label>
                <Textarea
                  id="img-desc"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="图片描述"
                  className="mt-1 h-20 rounded-xl resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="img-author">作者</Label>
                  <Input
                    id="img-author"
                    value={uploadForm.author}
                    onChange={(e) => setUploadForm((p) => ({ ...p, author: e.target.value }))}
                    placeholder="作者名"
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="img-cat">分类</Label>
                  <Select
                    value={uploadForm.category}
                    onValueChange={(v) => setUploadForm((p) => ({ ...p, category: v || "" }))}
                  >
                    <SelectTrigger id="img-cat" className="mt-1 h-10 rounded-xl">
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="img-tags">标签</Label>
                <Input
                  id="img-tags"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm((p) => ({ ...p, tags: e.target.value }))}
                  placeholder="逗号分隔，如: 自然,风景"
                  className="mt-1 h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={uploading || (uploadMode === "file" ? !uploadForm.file : !uploadForm.url)}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {uploadMode === "url" ? "抓取中..." : "上传中..."}
                </>
              ) : (
                <>
                  {uploadMode === "url" ? <LinkIcon className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                  {uploadMode === "url" ? "抓取并上传" : "上传到服务器"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
