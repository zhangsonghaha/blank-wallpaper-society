"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, Bell, Sparkles, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EmailPreferences {
  weekly_digest: boolean;
  activity_notice: boolean;
  creator_update: boolean;
  is_unsubscribed: boolean;
  unsub_token: string | null;
}

export default function EmailPreferenceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 打开时加载数据
  useEffect(() => {
    if (open) {
      fetchPreferences();
    }
  }, [open]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/email-preferences");
      const data = await res.json();
      if (res.ok) {
        setPreferences(data);
        setHasChanges(false);
      } else {
        toast.error(data.error || "获取偏好设置失败");
      }
    } catch {
      toast.error("获取偏好设置失败");
    }
    setLoading(false);
  };

  const handlePreferenceChange = (type: keyof EmailPreferences, value: boolean) => {
    if (!preferences) return;
    setPreferences((prev) => (prev ? { ...prev, [type]: value } : null));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      const res = await fetch("/api/user/email-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekly_digest: preferences.weekly_digest,
          activity_notice: preferences.activity_notice,
          creator_update: preferences.creator_update,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("邮件偏好已保存");
        // 如果重新订阅，更新状态
        if (
          preferences.is_unsubscribed &&
          (preferences.weekly_digest || preferences.activity_notice || preferences.creator_update)
        ) {
          setPreferences((prev) => (prev ? { ...prev, is_unsubscribed: false } : null));
        }
        setHasChanges(false);
      } else {
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const SUBSCRIPTION_ITEMS = [
    {
      key: "weekly_digest" as const,
      icon: <Mail className="w-4 h-4 text-[var(--color-primary)]" />,
      label: "每周精选",
      desc: "每周为您精选最热门的壁纸",
    },
    {
      key: "activity_notice" as const,
      icon: <Bell className="w-4 h-4 text-[var(--color-primary)]" />,
      label: "活动通知",
      desc: "重要活动、新功能和优惠通知",
    },
    {
      key: "creator_update" as const,
      icon: <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />,
      label: "创作者动态",
      desc: "关注的创作者新作品通知",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            邮件订阅偏好
          </DialogTitle>
          <DialogDescription>
            管理您希望收到的邮件类型
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : !preferences ? (
          <p className="text-[var(--color-mute)] text-center py-8">无法加载偏好设置</p>
        ) : (
          <div className="space-y-4 py-2">
            {/* 退订状态提示 */}
            {preferences.is_unsubscribed && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-800">
                  您已退订所有邮件。如需重新订阅，请开启下方选项并保存。
                </p>
              </div>
            )}

            {/* 订阅选项 */}
            <div className="space-y-1">
              {SUBSCRIPTION_ITEMS.map((item, idx) => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between py-3 px-4 rounded-lg bg-[var(--color-surface-card)] ${
                    idx < SUBSCRIPTION_ITEMS.length - 1 ? "mb-1" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <div>
                      <Label className="font-medium text-sm">{item.label}</Label>
                      <p className="text-xs text-[var(--color-mute)] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences[item.key] as boolean}
                    onCheckedChange={(checked) => handlePreferenceChange(item.key, checked)}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>

            {/* 当前生效状态 */}
            {!preferences.is_unsubscribed && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">当前订阅状态</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUBSCRIPTION_ITEMS.filter((item) => preferences[item.key]).length > 0 ? (
                    SUBSCRIPTION_ITEMS.filter((item) => preferences[item.key]).map((item) => (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700"
                      >
                        {item.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-emerald-700">未订阅任何邮件</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-xs text-[var(--color-mute)]">
            {hasChanges ? "有未保存的更改" : "当前设置已生效"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
              disabled={saving}
            >
              关闭
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges || !preferences}
              className="rounded-full gap-1"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}