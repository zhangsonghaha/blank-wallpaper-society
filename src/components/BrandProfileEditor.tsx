"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Loader2,
  Save,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { withCsrfHeader } from "@/lib/csrf-client";

interface SocialLinks {
  weibo?: string;
  twitter?: string;
  bilibili?: string;
  xiaohongshu?: string;
  instagram?: string;
  github?: string;
  [key: string]: string | undefined;
}

interface BrandProfileData {
  brand_name: string;
  brand_description: string;
  brand_website: string;
  social_links: SocialLinks | null;
}

interface BrandProfileEditorProps {
  initialData: BrandProfileData | null;
  onSaveSuccess?: () => void;
}

const SOCIAL_PLATFORMS = [
  { key: "weibo", label: "微博", prefix: "https://weibo.com/" },
  { key: "twitter", label: "Twitter/X", prefix: "https://twitter.com/" },
  { key: "bilibili", label: "B站", prefix: "https://space.bilibili.com/" },
  { key: "xiaohongshu", label: "小红书", prefix: "https://xiaohongshu.com/" },
  { key: "instagram", label: "Instagram", prefix: "https://instagram.com/" },
  { key: "github", label: "GitHub", prefix: "https://github.com/" },
];

export default function BrandProfileEditor({
  initialData,
  onSaveSuccess,
}: BrandProfileEditorProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand_name: initialData?.brand_name || "",
    brand_description: initialData?.brand_description || "",
    brand_website: initialData?.brand_website || "",
    social_links: initialData?.social_links || {},
  });

  const handleSocialLinkChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      social_links: { ...formData.social_links, [key]: value },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.brand_name.trim()) {
      toast.error("品牌名称不能为空");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/creator/brand", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...await withCsrfHeader(),
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        onSaveSuccess?.();
      } else {
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("更新失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          品牌资料
        </CardTitle>
        <CardDescription>
          自定义您的创作者主页，展示品牌形象
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand_name">品牌名称 *</Label>
            <Input
              id="brand_name"
              value={formData.brand_name}
              onChange={(e) =>
                setFormData({ ...formData, brand_name: e.target.value })
              }
              placeholder="您的品牌/工作室名称"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_description">品牌简介</Label>
            <Textarea
              id="brand_description"
              value={formData.brand_description}
              onChange={(e) =>
                setFormData({ ...formData, brand_description: e.target.value })
              }
              placeholder="介绍您的品牌理念、创作方向等"
              maxLength={1000}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_website" className="flex items-center gap-1">
              <Globe className="w-4 h-4" /> 品牌官网
            </Label>
            <Input
              id="brand_website"
              value={formData.brand_website}
              onChange={(e) =>
                setFormData({ ...formData, brand_website: e.target.value })
              }
              placeholder="https://your-brand.com"
              type="url"
              maxLength={500}
            />
          </div>

          <div className="space-y-3">
            <Label>社交链接</Label>
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform.key} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-20 shrink-0">
                  {platform.label}
                </span>
                <Input
                  value={formData.social_links?.[platform.key] || ""}
                  onChange={(e) =>
                    handleSocialLinkChange(platform.key, e.target.value)
                  }
                  placeholder={platform.prefix}
                  className="flex-1"
                />
              </div>
            ))}
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存品牌资料
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}