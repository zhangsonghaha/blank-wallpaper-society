"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function CollectionDialog({
  open,
  onOpenChange,
  onSuccess,
}: CollectionDialogProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("请输入合集标题");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        }),
      });

      if (res.ok) {
        toast.success("合集创建成功");
        setTitle("");
        setDescription("");
        setIsPublic(true);
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建失败，请重试");
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>创建合集</DialogTitle>
          <DialogDescription>
            创建一个合集来整理你喜欢的壁纸
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="collection-title">标题</Label>
            <Input
              id="collection-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给合集取个名字"
              maxLength={100}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="collection-desc">描述（可选）</Label>
            <Textarea
              id="collection-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述一下这个合集的内容..."
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="w-4 h-4 text-[var(--color-mute)]" />
                ) : (
                  <Lock className="w-4 h-4 text-[var(--color-mute)]" />
                )}
                {isPublic ? "公开合集" : "私密合集"}
              </Label>
              <p className="text-xs text-[var(--color-mute)]">
                {isPublic ? "所有人都可以看到这个合集" : "只有你可以看到这个合集"}
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-2"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}