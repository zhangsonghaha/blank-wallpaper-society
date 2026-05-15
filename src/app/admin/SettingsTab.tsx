"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Globe,
  Image as ImageIcon,
  Shield,
  Save,
  RotateCcw,
  Server,
  Paintbrush,
  UserCheck,
  Key,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/* ==================== 类型定义 ==================== */

interface SettingItem {
  id: number;
  setting_key: string;
  setting_value: string | null;
  description: string | null;
  updated_at: string;
}

/* ==================== 设置分组配置 ==================== */

interface SettingField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "toggle";
  description?: string;
  placeholder?: string;
}

interface SettingGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  fields: SettingField[];
}

const settingGroups: SettingGroup[] = [
  {
    id: "general",
    title: "基本设置",
    icon: Globe,
    description: "网站基本信息和通用配置",
    fields: [
      { key: "site_name", label: "网站名称", type: "text", placeholder: "输入网站名称" },
      { key: "site_description", label: "网站描述", type: "textarea", placeholder: "输入网站描述" },
      { key: "items_per_page", label: "每页显示数量", type: "number", description: "列表页每页展示的项目数" },
    ],
  },
  {
    id: "upload",
    title: "上传设置",
    icon: ImageIcon,
    description: "图片上传相关配置",
    fields: [
      { key: "max_upload_size", label: "最大上传大小 (MB)", type: "number", description: "单张图片最大允许的上传大小" },
      { key: "max_images_per_user", label: "用户最大上传数", type: "number", description: "0 表示无限制" },
    ],
  },
  {
    id: "review",
    title: "审核设置",
    icon: Shield,
    description: "图片审核和用户管理配置",
    fields: [
      { key: "require_review", label: "图片需要审核", type: "toggle", description: "开启后用户上传的图片需要管理员审核才能显示" },
      { key: "allow_registration", label: "允许注册", type: "toggle", description: "关闭后新用户无法注册账号" },
    ],
  },
  {
    id: "watermark",
    title: "水印设置",
    icon: Paintbrush,
    description: "图片水印保护配置",
    fields: [
      { key: "watermark_enabled", label: "启用水印", type: "toggle", description: "开启后预览图将自动叠加水印" },
      { key: "watermark_text", label: "水印文字", type: "text", placeholder: "输入水印文字" },
    ],
  },
  {
    id: "system",
    title: "系统设置",
    icon: Server,
    description: "系统级配置，谨慎修改",
    fields: [
      { key: "maintenance_mode", label: "维护模式", type: "toggle", description: "开启后普通用户无法访问网站" },
    ],
  },
  {
    id: "oauth",
    title: "OAuth 登录配置",
    icon: Key,
    description: "第三方登录凭据配置，配置后需重启服务生效",
    fields: [
      { key: "google_login_enabled", label: "启用 Google 登录", type: "toggle", description: "开启前需配置 Google Client ID 和 Secret" },
      { key: "google_client_id", label: "Google Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com" },
      { key: "google_client_secret", label: "Google Client Secret", type: "text", placeholder: "GOCSPX-xxxx", description: "从 Google Cloud Console 获取" },
      { key: "github_login_enabled", label: "启用 GitHub 登录", type: "toggle", description: "开启前需配置 GitHub Client ID 和 Secret" },
      { key: "github_client_id", label: "GitHub Client ID", type: "text", placeholder: "如 Ov23lixxxxx" },
      { key: "github_client_secret", label: "GitHub Client Secret", type: "text", placeholder: "如 abc123xxxxx", description: "从 GitHub Developer Settings 获取" },
    ],
  },
];

/* ==================== 系统设置组件 ==================== */

export default function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  /* ==================== 数据加载 ==================== */

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("获取设置失败");
      const data = await res.json();

      const settingsMap: Record<string, string> = {};
      (data || []).forEach((item: SettingItem) => {
        settingsMap[item.setting_key] = item.setting_value || "";
      });

      setSettings(settingsMap);
      setOriginalSettings(settingsMap);
      setHasChanges(false);
    } catch (err) {
      console.error("加载设置失败:", err);
      toast.error("加载设置失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ==================== 设置修改 ==================== */

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalSettings));
      return updated;
    });
  };

  const toggleSetting = (key: string) => {
    const currentValue = settings[key];
    const newValue = currentValue === "true" ? "false" : "true";
    updateSetting(key, newValue);
  };

  /* ==================== 保存设置 ==================== */

  const handleSave = async () => {
    setSaving(true);
    try {
      // 只提交变更的设置
      const changed: Record<string, string> = {};
      Object.entries(settings).forEach(([key, value]) => {
        if (value !== originalSettings[key]) {
          changed[key] = value;
        }
      });

      if (Object.keys(changed).length === 0) {
        toast.info("没有修改需要保存");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changed }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("设置已保存");
        setOriginalSettings({ ...settings });
        setHasChanges(false);
      } else {
        toast.error("保存失败", { description: data.error });
      }
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handleReset = () => {
    setSettings({ ...originalSettings });
    setHasChanges(false);
    toast.info("已重置为上次保存的设置");
  };

  /* ==================== 渲染 ==================== */

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">系统设置</h2>
          <p className="text-sm text-[var(--color-mute)]">管理网站的全局配置参数</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="rounded-full text-xs text-amber-600 border-amber-300 bg-amber-50">
              有未保存的修改
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
            className="rounded-full"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="rounded-full"
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {settingGroups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-4">
                  {group.fields.map((_, i) => (
                    <div key={i}>
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {settingGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <Card key={group.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-card)] flex items-center justify-center">
                      <GroupIcon className="w-5 h-5 text-[var(--color-mute)]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{group.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {group.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {group.fields.map((field, fieldIndex) => (
                    <div key={field.key}>
                      {fieldIndex > 0 && <Separator className="mb-5" />}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="sm:w-48 flex-shrink-0">
                          <Label className="text-sm font-medium">{field.label}</Label>
                          {field.description && (
                            <p className="text-xs text-[var(--color-ash)] mt-0.5">
                              {field.description}
                            </p>
                          )}
                        </div>
                        <div className="flex-1">
                          {field.type === "toggle" ? (
                            <button
                              onClick={() => toggleSetting(field.key)}
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                settings[field.key] === "true"
                                  ? "bg-emerald-500"
                                  : "bg-[var(--color-surface-card)]"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform ${
                                  settings[field.key] === "true"
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          ) : field.type === "textarea" ? (
                            <Textarea
                              value={settings[field.key] || ""}
                              onChange={(e) => updateSetting(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="rounded-lg min-h-[80px]"
                            />
                          ) : (
                            <Input
                              type={field.type}
                              value={settings[field.key] || ""}
                              onChange={(e) => updateSetting(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="rounded-lg"
                              min={field.type === "number" ? 0 : undefined}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}