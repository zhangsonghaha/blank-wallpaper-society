"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sparkles, Save, Loader2, XCircle, CheckCircle, Globe, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { withCsrfHeader } from "@/lib/csrf-client";

interface ProfileCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 初始数据 */
  initialBio?: string;
  initialSocialLinks?: Record<string, string>;
  initialFeaturedCollections?: number[];
  /** 用户合集列表 */
  collections: any[];
  userId: number;
  onSaveSuccess?: () => void;
}

const SOCIAL_PLATFORMS = [
  { key: "weibo", label: "微博" },
  { key: "twitter", label: "Twitter/X" },
  { key: "bilibili", label: "B站" },
  { key: "xiaohongshu", label: "小红书" },
  { key: "instagram", label: "Instagram" },
];

export default function ProfileCustomizationDialog({
  open,
  onOpenChange,
  initialBio = "",
  initialSocialLinks = {},
  initialFeaturedCollections = [],
  collections,
  onSaveSuccess,
}: ProfileCustomizationDialogProps) {
  const [bio, setBio] = useState(initialBio);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(initialSocialLinks);
  const [featuredCollections, setFeaturedCollections] = useState<number[]>(initialFeaturedCollections);
  const [saving, setSaving] = useState(false);

  // 打开时同步初始数据
  useEffect(() => {
    if (open) {
      setBio(initialBio);
      setSocialLinks(initialSocialLinks);
      setFeaturedCollections(initialFeaturedCollections);
    }
  }, [open, initialBio, initialSocialLinks, initialFeaturedCollections]);

  const hasChanges =
    bio !== initialBio ||
    JSON.stringify(socialLinks) !== JSON.stringify(initialSocialLinks) ||
    JSON.stringify(featuredCollections) !== JSON.stringify(initialFeaturedCollections);

  const handleSave = async () => {
    setSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/user/profile-customization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          bio,
          social_links: socialLinks,
          featured_collections: featuredCollections,
        }),
      });
      if (res.ok) {
        toast.success("主页定制已保存");
        onSaveSuccess?.();
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("保存失败，请重试");
    }
    setSaving(false);
  };

  // 计算已填信息摘要
  const filledSocialCount = SOCIAL_PLATFORMS.filter((p) => socialLinks[p.key]?.trim()).length;
  const filledCollectionCount = featuredCollections.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            主页定制
          </DialogTitle>
          <DialogDescription>
            个性化您的主页，让其他人更好地了解您
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 个人简介 */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                个人简介
              </span>
              <span className="text-xs text-[var(--color-mute)]">{bio.length}/200</span>
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => {
                if (e.target.value.length <= 200) setBio(e.target.value);
              }}
              placeholder="介绍一下自己吧..."
              maxLength={200}
              rows={3}
              className="rounded-xl resize-none"
            />
            {bio && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                已填写简介，将展示在您的公开主页
              </p>
            )}
          </div>

          {/* 社交链接 */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                社交链接
              </span>
              <span className="text-xs text-[var(--color-mute)]">
                {filledSocialCount > 0 ? `已添加 ${filledSocialCount} 个` : "最多5个"}
              </span>
            </Label>
            <div className="space-y-2">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform.key} className="flex items-center gap-2">
                  <span className="text-sm text-[var(--color-mute)] w-20 shrink-0">
                    {platform.label}
                  </span>
                  <Input
                    value={socialLinks[platform.key] || ""}
                    onChange={(e) => {
                      setSocialLinks({ ...socialLinks, [platform.key]: e.target.value });
                    }}
                    placeholder={`输入${platform.label}链接或用户名`}
                    className="flex-1 rounded-xl h-9"
                    maxLength={200}
                  />
                  {socialLinks[platform.key] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      onClick={() => {
                        const newLinks = { ...socialLinks };
                        delete newLinks[platform.key];
                        setSocialLinks(newLinks);
                      }}
                    >
                      <XCircle className="w-4 h-4 text-[var(--color-mute)]" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 精选合集 */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>精选合集置顶</span>
              <span className="text-xs text-[var(--color-mute)]">
                {filledCollectionCount > 0 ? `已选 ${filledCollectionCount}/3` : "最多3个"}
              </span>
            </Label>
            {collections.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {collections.slice(0, 10).map((col: any) => {
                  const isSelected = featuredCollections.includes(col.id);
                  return (
                    <div
                      key={col.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        isSelected
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                          : "border-[var(--color-hairline)] bg-[var(--color-surface-card)] hover:border-[var(--color-primary)]/50"
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setFeaturedCollections(featuredCollections.filter((id) => id !== col.id));
                        } else if (featuredCollections.length < 3) {
                          setFeaturedCollections([...featuredCollections, col.id]);
                        } else {
                          toast.error("最多选择3个合集");
                        }
                      }}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm text-[var(--color-ink)] truncate">{col.name}</span>
                      <span className="text-xs text-[var(--color-mute)] ml-auto shrink-0">
                        {col.image_count || 0}张
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-mute)]">暂无合集，请先创建合集</p>
            )}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-xs text-[var(--color-mute)]">
            {hasChanges ? "有未保存的更改" : "无更改"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
              disabled={saving}
            >
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="rounded-full gap-1"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}