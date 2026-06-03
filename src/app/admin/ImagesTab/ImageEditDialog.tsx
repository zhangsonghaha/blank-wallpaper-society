"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import type { Category, EditForm } from "./types";

interface ImageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  editSaving: boolean;
  categories: Category[];
  onSave: () => void;
}

export default function ImageEditDialog({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  editSaving,
  categories,
  onSave,
}: ImageEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">编辑图片信息</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-title">标题 *</Label>
            <Input
              id="edit-title"
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="图片标题"
              className="mt-1 h-10 rounded-xl"
            />
          </div>
          <div>
            <Label htmlFor="edit-desc">描述</Label>
            <Textarea
              id="edit-desc"
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="图片描述"
              className="mt-1 h-20 rounded-xl resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-author">作者</Label>
              <Input
                id="edit-author"
                value={editForm.author}
                onChange={(e) => setEditForm((p) => ({ ...p, author: e.target.value }))}
                placeholder="作者名"
                className="mt-1 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="edit-cat">分类</Label>
              <Select
                value={editForm.category}
                onValueChange={(v) => setEditForm((p) => ({ ...p, category: v || "" }))}
              >
                <SelectTrigger id="edit-cat" className="mt-1 h-10 rounded-xl">
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
            <Label htmlFor="edit-tags">标签</Label>
            <Input
              id="edit-tags"
              value={editForm.tags}
              onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))}
              placeholder="逗号分隔，如: 自然,风景"
              className="mt-1 h-10 rounded-xl"
            />
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
            type="button"
            disabled={editSaving}
            onClick={onSave}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] rounded-full gap-2"
          >
            {editSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                保存中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                保存修改
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
