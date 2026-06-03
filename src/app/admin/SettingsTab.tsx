"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
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
  Search,
  RefreshCw,
  Trash2,
  Database,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
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
  type: "text" | "number" | "textarea" | "toggle" | "password" | "select";
  description?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
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
      { key: "watermark_enabled", label: "启用水印", type: "toggle", description: "开启后下载图片时将自动叠加水印" },
      { key: "watermark_text", label: "水印文字", type: "text", placeholder: "输入水印文字", description: "显示在图片上的水印文字内容" },
      {
        key: "watermark_position",
        label: "水印位置",
        type: "select",
        description: "水印在图片上的显示位置",
        options: [
          { value: "bottom-right", label: "右下角" },
          { value: "bottom-left", label: "左下角" },
          { value: "top-right", label: "右上角" },
          { value: "top-left", label: "左上角" },
          { value: "center", label: "居中" },
        ],
      },
      { key: "watermark_opacity", label: "水印透明度", type: "number", description: "0-1 之间，值越小越透明（推荐 0.15）", placeholder: "0.15" },
      {
        key: "watermark_color",
        label: "水印颜色",
        type: "select",
        description: "水印文字颜色",
        options: [
          { value: "white", label: "白色" },
          { value: "black", label: "黑色" },
          { value: "gray", label: "灰色" },
        ],
      },
      { key: "watermark_tiled", label: "平铺防盗水印", type: "toggle", description: "开启后在图片中央区域添加旋转平铺的半透明水印，防止裁切盗用" },
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
      { key: "google_client_secret", label: "Google Client Secret", type: "text", placeholder: "GOCSPX-xxxx", description: "从 Google Cloud Console 获取，回调地址：{网站域名}/api/auth/callback/google" },
      { key: "github_login_enabled", label: "启用 GitHub 登录", type: "toggle", description: "开启前需配置 GitHub Client ID 和 Secret" },
      { key: "github_client_id", label: "GitHub Client ID", type: "text", placeholder: "如 Ov23lixxxxx" },
      { key: "github_client_secret", label: "GitHub Client Secret", type: "text", placeholder: "如 abc123xxxxx", description: "从 GitHub Developer Settings 获取，回调地址：{网站域名}/api/auth/callback/github" },
    ],
  },
  {
    id: "email",
    title: "邮件服务配置",
    icon: Server,
    description: "邮件发送服务配置，用于密码重置、通知推送等功能",
    fields: [
      { key: "email_enabled", label: "启用邮件服务", type: "toggle", description: "开启后系统将发送邮件通知" },
      { key: "email_provider", label: "邮件服务商", type: "text", placeholder: "resend / smtp", description: "选择邮件发送方式：resend 或 smtp" },
      { key: "email_from", label: "发件人地址", type: "text", placeholder: "noreply@imagegallery.app", description: "邮件发件人地址" },
      { key: "resend_api_key", label: "Resend API Key", type: "password", placeholder: "re_xxxxxxxx", description: "Resend 邮件服务密钥" },
      { key: "smtp_host", label: "SMTP 主机", type: "text", placeholder: "smtp.example.com", description: "SMTP 服务器地址（使用 SMTP 模式时填写）" },
      { key: "smtp_port", label: "SMTP 端口", type: "number", placeholder: "587", description: "SMTP 服务器端口，通常为 587" },
      { key: "smtp_user", label: "SMTP 用户名", type: "text", placeholder: "user@example.com", description: "SMTP 登录用户名" },
      { key: "smtp_pass", label: "SMTP 密码", type: "password", placeholder: "••••••••", description: "SMTP 登录密码" },
    ],
  },
  {
    id: "ai",
    title: "AI 生成配置",
    icon: Sparkles,
    description: "AI 图片生成服务配置，支持 OpenAI 及兼容接口",
    fields: [
      { key: "ai_enabled", label: "启用 AI 生成", type: "toggle", description: "开启前需配置 API 密钥和接口地址" },
      { key: "ai_provider", label: "服务商", type: "text", placeholder: "openai / stability / custom", description: "选择 AI 服务提供商类型" },
      { key: "ai_api_base_url", label: "API 地址", type: "text", placeholder: "https://api.openai.com/v1", description: "API 基础地址，支持自定义兼容端点" },
      { key: "ai_api_key", label: "API 密钥", type: "password", placeholder: "sk-xxxx...", description: "API 密钥，将安全存储在数据库中" },
      { key: "ai_model", label: "模型名称", type: "text", placeholder: "dall-e-3", description: "使用的模型名称，如 dall-e-3、stable-diffusion-xl 等" },
    ],
  },
  {
    id: "nsfw",
    title: "NSFW 内容检测",
    icon: Shield,
    description: "自动检测上传图片是否包含违规内容，安全内容自动通过审核",
    fields: [
      { key: "nsfw_enabled", label: "启用 NSFW 检测", type: "toggle", description: "开启后上传图片将自动进行内容安全检测，安全内容自动通过审核" },
      { key: "nsfw_threshold", label: "检测阈值", type: "number", description: "0-1 之间，Porn/Hentai 概率超过此值标记为可疑（推荐 0.7）", placeholder: "0.7" },
      {
        key: "nsfw_action",
        label: "违规处理方式",
        type: "select",
        description: "检测到违规内容时的处理方式",
        options: [
          { value: "reject", label: "自动拒绝（违规直接拒绝，安全自动通过）" },
          { value: "pending", label: "待人工审核（违规标记为待审核，安全自动通过）" },
          { value: "flag", label: "仅标记（只记录不改变状态，需手动审核）" },
        ],
      },
    ],
  },
  {
    id: "quota",
    title: "存储配额",
    icon: Database,
    description: "用户存储空间限制配置，根据角色分配不同配额",
    fields: [
      { key: "quota_default_mb", label: "普通用户配额 (MB)", type: "number", description: "普通用户最大存储空间，默认 500MB", placeholder: "500" },
      { key: "quota_premium_mb", label: "付费用户配额 (MB)", type: "number", description: "付费/审核员用户最大存储空间，默认 2000MB", placeholder: "2000" },
      { key: "quota_admin_mb", label: "管理员配额 (MB)", type: "number", description: "管理员最大存储空间，默认 10000MB", placeholder: "10000" },
    ],
  },
  {
    id: "upload_advanced",
    title: "高级上传设置",
    icon: ImageIcon,
    description: "批量上传、文件限制等高级上传配置",
    fields: [
      { key: "batch_max_files", label: "批量上传最大文件数", type: "number", description: "单次批量上传允许的最大文件数，默认 5", placeholder: "5" },
      { key: "daily_upload_limit", label: "每日上传限制", type: "number", description: "非管理员每日上传图片数量限制，默认 10", placeholder: "10" },
    ],
  },
  {
    id: "monitoring",
    title: "监控与日志",
    icon: Server,
    description: "错误监控、日志级别等运维配置",
    fields: [
      { key: "sentry_enabled", label: "启用 Sentry 错误监控", type: "toggle", description: "开启后生产环境错误将上报到 Sentry" },
      { key: "sentry_dsn", label: "Sentry DSN", type: "password", placeholder: "https://xxx@sentry.io/xxx", description: "Sentry 项目 DSN 地址" },
      {
        key: "log_level",
        label: "日志级别",
        type: "select",
        description: "控制日志输出详细程度，生产环境建议 info",
        options: [
          { value: "fatal", label: "Fatal（仅致命错误）" },
          { value: "error", label: "Error（错误）" },
          { value: "warn", label: "Warn（警告）" },
          { value: "info", label: "Info（信息，推荐生产环境）" },
          { value: "debug", label: "Debug（调试，推荐开发环境）" },
          { value: "trace", label: "Trace（追踪，最详细）" },
        ],
      },
      { key: "db_connection_limit", label: "数据库连接池大小", type: "number", description: "MySQL 连接池最大连接数，默认 15", placeholder: "15" },
    ],
  },
  {
    id: "analytics",
    title: "用户行为分析",
    icon: Server,
    description: "集成 Umami 或 PostHog 进行用户行为追踪",
    fields: [
      {
        key: "analytics_provider",
        label: "分析服务",
        type: "select",
        description: "选择用户行为分析服务提供商",
        options: [
          { value: "none", label: "不启用" },
          { value: "umami", label: "Umami（自托管，推荐）" },
          { value: "posthog", label: "PostHog" },
        ],
      },
      { key: "analytics_umami_website_id", label: "Umami 网站 ID", type: "text", placeholder: "如：a1b2c3d4-xxxx", description: "Umami 后台获取的网站 ID" },
      { key: "analytics_umami_api_url", label: "Umami API 地址", type: "text", placeholder: "https://analytics.example.com", description: "Umami 实例地址（不含 /api）" },
      { key: "analytics_posthog_api_key", label: "PostHog API Key", type: "password", placeholder: "phc_xxxx", description: "PostHog 项目 API Key" },
      { key: "analytics_posthog_api_host", label: "PostHog API Host", type: "text", placeholder: "https://app.posthog.com", description: "PostHog 实例地址，默认为官方 SaaS" },
    ],
  },
  {
    id: "login_wallpaper",
    title: "登录页壁纸",
    icon: ImageIcon,
    description: "配置登录页开场动画使用的壁纸来源",
    fields: [
      {
        key: "login_wallpaper_source",
        label: "壁纸来源",
        type: "select",
        description: "选择登录页开场动画壁纸的来源",
        options: [
          { value: "unsplash", label: "Unsplash 精选（默认）" },
          { value: "custom", label: "自定义图片" },
        ],
      },
      { key: "login_wallpaper_urls", label: "自定义图片 URL", type: "textarea", placeholder: '每行一个图片链接\n如：\nhttps://example.com/1.jpg\nhttps://example.com/2.jpg', description: "选择「自定义图片」来源时使用，每行一个完整的图片 URL（建议 300×300 裁剪参数）" },
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

  /* ==================== 健康检查状态 ==================== */
  const [healthData, setHealthData] = useState<{
    status: string;
    timestamp: string;
    latency: number;
    checks: Record<string, { status: string; latency?: number; error?: string; detail?: string }>;
    version: string;
    uptime: string;
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthData(data);
    } catch {
      setHealthData(null);
    }
    setHealthLoading(false);
  }, []);

  /* ==================== 搜索管理状态 ==================== */
  const [searchAvailable, setSearchAvailable] = useState(false);
  const [searchStats, setSearchStats] = useState<{
    numberOfDocuments: number;
    isIndexing: boolean;
    lastUpdate: string;
  } | null>(null);
  const [dbTotal, setDbTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  /* ==================== 邮件测试状态 ==================== */
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    to?: string;
  } | null>(null);

  /* ==================== AI 连通性测试状态 ==================== */
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    modelsAvailable?: number;
    hasTargetModel?: boolean;
    modelList?: string[];
  } | null>(null);

  /* ==================== 数据加载 ==================== */

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("获取设置失败");
      const data = await res.json();

      const settingsMap: Record<string, string> = {};
      (data || []).forEach((item: SettingItem) => {
        const key = item.setting_key;
        let val = item.setting_value || "";
        // 登录页自定义壁纸 URL：JSON 数组 → 换行分隔文本
        if (key === "login_wallpaper_urls" && val.startsWith("[")) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) val = arr.join("\n");
          } catch { /* 保持原值 */ }
        }
        settingsMap[key] = val;
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
    fetchHealth();
  }, [loadData, fetchHealth]);

  /* ==================== 搜索管理数据加载 ==================== */

  const loadSearchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/search-sync");
      if (!res.ok) return;
      const data = await res.json();
      setSearchAvailable(data.available);
      setSearchStats(data.stats);
      setDbTotal(data.dbTotal || 0);
    } catch {
      setSearchAvailable(false);
    }
  }, []);

  useEffect(() => {
    loadSearchStats();
  }, [loadSearchStats]);

  const handleSyncIndex = async () => {
    setSyncing(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/search-sync", { method: "POST", headers: { ...csrfHeaders } });
      const data = await res.json();
      if (res.ok) {
        toast.success(`同步完成，已索引 ${data.synced} 张图片`);
        loadSearchStats();
      } else {
        toast.error("同步失败", { description: data.error });
      }
    } catch {
      toast.error("同步失败");
    }
    setSyncing(false);
  };

  const handleRebuildIndex = async () => {
    if (!confirm("确定要重建索引吗？这会清空现有索引并重新同步所有图片。")) return;
    setRebuilding(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/search-sync", { method: "DELETE", headers: { ...csrfHeaders } });
      const data = await res.json();
      if (res.ok) {
        toast.success(`索引重建完成，已索引 ${data.synced} 张图片`);
        loadSearchStats();
      } else {
        toast.error("重建失败", { description: data.error });
      }
    } catch {
      toast.error("重建失败");
    }
    setRebuilding(false);
  };

  /* ==================== 邮件发送测试 ==================== */

  const handleEmailTest = async () => {
    setEmailTesting(true);
    setEmailTestResult(null);
    try {
      const testTo = settings.email_from || undefined;
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      setEmailTestResult({ success: res.ok, ...data });

      if (res.ok) {
        toast.success("测试邮件已发送");
      } else {
        toast.error("邮件发送失败", { description: data.error });
      }
    } catch {
      setEmailTestResult({ success: false, error: "请求失败" });
      toast.error("测试请求失败");
    }
    setEmailTesting(false);
  };

  /* ==================== AI 连通性测试 ==================== */

  const handleAiTest = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      // 如果有未保存的设置，使用临时配置测试
      const testPayload: Record<string, string> = {};
      if (settings.ai_api_key && settings.ai_api_key !== originalSettings.ai_api_key) {
        testPayload.provider = settings.ai_provider || "openai";
        testPayload.apiKey = settings.ai_api_key;
        testPayload.baseUrl = settings.ai_api_base_url || "https://api.openai.com/v1";
        testPayload.model = settings.ai_model || "dall-e-3";
      }

      const res = await fetch("/api/admin/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify(testPayload),
      });
      const data = await res.json();
      setAiTestResult(data);

      if (data.success) {
        toast.success("AI 服务连接成功");
      } else {
        toast.error("AI 服务连接失败", { description: data.error });
      }
    } catch {
      setAiTestResult({ success: false, error: "请求失败" });
      toast.error("测试请求失败");
    }
    setAiTesting(false);
  };

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

      // 登录页自定义壁纸 URL：换行分隔文本 → JSON 数组
      if (changed.login_wallpaper_urls) {
        const lines = changed.login_wallpaper_urls
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        changed.login_wallpaper_urls = JSON.stringify(lines);
      }

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
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
            <Badge variant="outline" className="rounded-full text-xs text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-900/10">
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

      {/* ===== 健康检查状态面板 ===== */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[var(--color-primary)]" />
              <CardTitle className="text-base">系统健康状态</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              disabled={healthLoading}
              className="rounded-full text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${healthLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
          <CardDescription>实时监控数据库、Redis、MinIO 连接状态</CardDescription>
        </CardHeader>
        <CardContent>
          {healthData ? (
            <div className="space-y-3">
              {/* 总体状态 */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-muted)]">
                <div className="flex items-center gap-2">
                  {healthData.status === "healthy" ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : healthData.status === "degraded" ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-semibold text-sm">
                    {healthData.status === "healthy" ? "运行正常" : healthData.status === "degraded" ? "部分降级" : "异常"}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-mute)] space-x-3">
                  <span>版本 {healthData.version}</span>
                  <span>运行 {healthData.uptime}</span>
                  <span>检测耗时 {healthData.latency}ms</span>
                </div>
              </div>
              {/* 各检查项 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(healthData.checks).map(([name, check]) => (
                  <div key={name} className={`p-3 rounded-lg border ${
                    check.status === "ok" ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10" :
                    check.status === "warning" ? "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/10" :
                    "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {check.status === "ok" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : check.status === "warning" ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-medium text-sm capitalize">{name === "database" ? "数据库" : name === "redis" ? "Redis" : "MinIO 存储"}</span>
                    </div>
                    {check.latency !== undefined && (
                      <p className="text-xs text-[var(--color-mute)]">延迟: {check.latency}ms</p>
                    )}
                    {check.detail && (
                      <p className="text-xs text-[var(--color-mute)]">{check.detail}</p>
                    )}
                    {check.error && (
                      <p className="text-xs text-red-500 truncate" title={check.error}>{check.error}</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--color-mute)] text-right">
                最后检查: {new Date(healthData.timestamp).toLocaleString("zh-CN")}
              </p>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-[var(--color-mute)]">
              {healthLoading ? "检测中..." : "点击刷新获取系统健康状态"}
            </div>
          )}
        </CardContent>
      </Card>

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
                          ) : field.type === "select" ? (
                            <select
                              value={settings[field.key] || ""}
                              onChange={(e) => updateSetting(field.key, e.target.value)}
                              className="w-full rounded-lg border border-[var(--color-surface-card)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                              {field.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "textarea" ? (
                            <Textarea
                              value={settings[field.key] || ""}
                              onChange={(e) => updateSetting(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="rounded-lg min-h-[80px]"
                            />
                          ) : field.type === "password" ? (
                            <Input
                              type="password"
                              value={settings[field.key] || ""}
                              onChange={(e) => updateSetting(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="rounded-lg"
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

      {/* Meilisearch 搜索管理 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-card)] flex items-center justify-center">
              <Search className="w-5 h-5 text-[var(--color-mute)]" />
            </div>
            <div>
              <CardTitle className="text-base">搜索服务 (Meilisearch)</CardTitle>
              <CardDescription className="text-xs">
                全文搜索引擎配置与索引管理
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 连接状态 */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${searchAvailable ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-sm">
              {searchAvailable ? "Meilisearch 已连接" : "Meilisearch 未连接"}
            </span>
            <button
              onClick={loadSearchStats}
              className="ml-auto text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {searchAvailable && searchStats && (
            <>
              {/* 索引统计 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
                  <div className="text-xs text-[var(--color-mute)] mb-1">索引文档数</div>
                  <div className="text-lg font-bold text-[var(--color-ink)]">
                    {searchStats.numberOfDocuments.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
                  <div className="text-xs text-[var(--color-mute)] mb-1">数据库图片数</div>
                  <div className="text-lg font-bold text-[var(--color-ink)]">
                    {dbTotal.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 同步状态 */}
              <div className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
                <Database className="w-3.5 h-3.5" />
                {searchStats.isIndexing ? (
                  <span className="text-amber-500">正在索引中...</span>
                ) : searchStats.numberOfDocuments === dbTotal ? (
                  <span className="text-emerald-600">索引已同步</span>
                ) : (
                  <span className="text-amber-500">
                    未同步 ({dbTotal - searchStats.numberOfDocuments} 张待同步)
                  </span>
                )}
                {searchStats.lastUpdate && (
                  <span className="ml-auto">
                    更新于 {new Date(searchStats.lastUpdate).toLocaleString("zh-CN")}
                  </span>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={handleSyncIndex}
                  disabled={syncing || rebuilding}
                  variant="outline"
                  className="rounded-full"
                  size="sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "同步中..." : "同步索引"}
                </Button>
                <Button
                  onClick={handleRebuildIndex}
                  disabled={syncing || rebuilding}
                  variant="outline"
                  className="rounded-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  size="sm"
                >
                  <Trash2 className={`w-3.5 h-3.5 mr-1.5 ${rebuilding ? "animate-spin" : ""}`} />
                  {rebuilding ? "重建中..." : "重建索引"}
                </Button>
              </div>
            </>
          )}

          {!searchAvailable && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400 text-xs">
              <p className="font-medium mb-1">Meilisearch 未配置或不可用</p>
              <p className="text-amber-600 dark:text-amber-400">
                请确保已设置环境变量 MEILISEARCH_HOST 和 MEILISEARCH_API_KEY，
                并且 Meilisearch 服务已启动。未配置时搜索将使用数据库 LIKE 查询。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 邮件服务测试 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-card)] flex items-center justify-center">
              <Server className="w-5 h-5 text-[var(--color-mute)]" />
            </div>
            <div>
              <CardTitle className="text-base">邮件服务测试</CardTitle>
              <CardDescription className="text-xs">
                验证邮件服务配置是否正确，发送测试邮件
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前配置概览 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
              <div className="text-xs text-[var(--color-mute)] mb-1">邮件服务商</div>
              <div className="text-sm font-medium">{settings.email_provider || "未配置"}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
              <div className="text-xs text-[var(--color-mute)] mb-1">发件人</div>
              <div className="text-sm font-medium break-all">{settings.email_from || "未配置"}</div>
            </div>
          </div>

          {settings.email_provider === "smtp" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
                <div className="text-xs text-[var(--color-mute)] mb-1">SMTP 主机</div>
                <div className="text-sm font-medium">{settings.smtp_host || "未配置"}</div>
              </div>
              <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
                <div className="text-xs text-[var(--color-mute)] mb-1">SMTP 端口</div>
                <div className="text-sm font-medium">{settings.smtp_port || "未配置"}</div>
              </div>
            </div>
          )}

          {/* 配置状态 */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${settings.email_enabled === "true" ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-sm">
              {settings.email_enabled === "true" ? "邮件服务已启用" : "邮件服务未启用"}
            </span>
          </div>

          {/* 测试按钮 */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={handleEmailTest}
              disabled={emailTesting || settings.email_enabled !== "true"}
              variant="outline"
              className="rounded-full"
              size="sm"
            >
              {emailTesting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Server className="w-3.5 h-3.5 mr-1.5" />
              )}
              {emailTesting ? "发送中..." : "发送测试邮件"}
            </Button>
          </div>

          {/* 测试结果 */}
          {emailTestResult && (
            <div className={`p-3 rounded-lg border ${
              emailTestResult.success
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                : "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {emailTestResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  emailTestResult.success ? "text-emerald-800" : "text-red-800"
                }`}>
                  {emailTestResult.success ? "发送成功" : "发送失败"}
                </span>
              </div>
              {emailTestResult.message && (
                <p className={`text-xs mt-1 ${emailTestResult.success ? "text-emerald-700" : "text-red-600"}`}>
                  {emailTestResult.message}
                </p>
              )}
              {emailTestResult.error && (
                <p className="text-xs text-red-600 mt-1">{emailTestResult.error}</p>
              )}
            </div>
          )}

          {/* 提示信息 */}
          {settings.email_enabled !== "true" && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400 text-xs">
              <p className="font-medium mb-1">邮件服务未启用</p>
              <p className="text-amber-600 dark:text-amber-400">
                请在上方"邮件服务配置"分组中启用邮件服务，并填写对应的配置信息（SMTP 或 Resend），然后点击发送测试邮件验证配置是否正确。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI 服务连通性测试 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-card)] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[var(--color-mute)]" />
            </div>
            <div>
              <CardTitle className="text-base">AI 服务连通性测试</CardTitle>
              <CardDescription className="text-xs">
                验证 AI API 配置是否正确，测试接口连通性
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前配置概览 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
              <div className="text-xs text-[var(--color-mute)] mb-1">服务商</div>
              <div className="text-sm font-medium">{settings.ai_provider || "未配置"}</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
              <div className="text-xs text-[var(--color-mute)] mb-1">模型</div>
              <div className="text-sm font-medium">{settings.ai_model || "未配置"}</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-surface-card)]">
            <div className="text-xs text-[var(--color-mute)] mb-1">API 地址</div>
            <div className="text-sm font-medium break-all">{settings.ai_api_base_url || "未配置"}</div>
          </div>

          {/* API 密钥状态 */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${settings.ai_api_key ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-sm">
              {settings.ai_api_key ? "API 密钥已配置" : "API 密钥未配置"}
            </span>
          </div>

          {/* 测试按钮 */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={handleAiTest}
              disabled={aiTesting || !settings.ai_api_key}
              variant="outline"
              className="rounded-full"
              size="sm"
            >
              {aiTesting ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {aiTesting ? "测试中..." : "测试连接"}
            </Button>
          </div>

          {/* 测试结果 */}
          {aiTestResult && (
            <div className={`p-3 rounded-lg border ${
              aiTestResult.success
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                : "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {aiTestResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm font-medium ${
                  aiTestResult.success ? "text-emerald-800" : "text-red-800"
                }`}>
                  {aiTestResult.success ? aiTestResult.message : "连接失败"}
                </span>
              </div>
              {aiTestResult.error && (
                <p className="text-xs text-red-600 mt-1">{aiTestResult.error}</p>
              )}
              {aiTestResult.success && (
                <div className="mt-2 space-y-1 text-xs text-emerald-700">
                  {aiTestResult.modelsAvailable !== undefined && (
                    <p>可用模型数: {aiTestResult.modelsAvailable}</p>
                  )}
                  {aiTestResult.hasTargetModel !== undefined && (
                    <p className={aiTestResult.hasTargetModel ? "text-emerald-700" : "text-amber-600"}>
                      目标模型 ({settings.ai_model}): {aiTestResult.hasTargetModel ? "已找到" : "未找到"}
                    </p>
                  )}
                  {aiTestResult.modelList && aiTestResult.modelList.length > 0 && (
                    <div className="mt-1">
                      <p className="text-[var(--color-mute)]">模型列表 (前20个):</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {aiTestResult.modelList.map((m) => (
                          <Badge
                            key={m}
                            variant="secondary"
                            className={`rounded-full text-[10px] px-1.5 py-0 ${
                              m === settings.ai_model ? "bg-emerald-100 text-emerald-700" : ""
                            }`}
                          >
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 提示信息 */}
          {!settings.ai_api_key && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/10 dark:text-amber-400 text-xs">
              <p className="font-medium mb-1">AI 生成功能未配置</p>
              <p className="text-amber-600 dark:text-amber-400">
                请在上方"AI 生成配置"分组中填写 API 地址、密钥和模型名称，然后点击测试连接验证配置是否正确。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}