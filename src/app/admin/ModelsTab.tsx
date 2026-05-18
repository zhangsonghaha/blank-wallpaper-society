"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Plus,
  Trash2,
  RefreshCw,
  Edit3,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Loader2,
  CheckCircle,
  XCircle,
  Search,
  Sparkles,
  Server,
  Key,
  Wand2,
  Star,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ==================== 类型定义 ==================== */

interface Provider {
  id: number;
  name: string;
  type: string;
  base_url: string;
  api_key: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface Model {
  id: number;
  provider_id: number;
  model_id: string;
  display_name: string | null;
  model_type: string;
  enabled: number;
  is_default: number;
  max_tokens: number;
  extra_config: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  provider_name?: string;
  provider_type?: string;
  provider_base_url?: string;
}

const PROVIDER_TYPE_OPTIONS = [
  { value: "openai", label: "OpenAI 兼容", icon: "🤖" },
  { value: "anthropic", label: "Anthropic", icon: "🧠" },
  { value: "google", label: "Google AI", icon: "🔮" },
  { value: "custom", label: "自定义", icon: "🔗" },
];

const MODEL_TYPE_OPTIONS = [
  { value: "chat", label: "对话模型", icon: "💬", color: "bg-blue-500" },
  { value: "image", label: "图片生成", icon: "🎨", color: "bg-purple-500" },
  { value: "embedding", label: "向量嵌入", icon: "📊", color: "bg-green-500" },
];

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
  custom: "",
};

export default function ModelsTab() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [discoveringId, setDiscoveringId] = useState<number | null>(null);

  // 编辑状态
  const [editingProvider, setEditingProvider] = useState<Partial<Provider> & { isNew?: boolean } | null>(null);
  const [editingModel, setEditingModel] = useState<Partial<Model> & { isNew?: boolean } | null>(null);

  // 活跃标签
  const [activeSection, setActiveSection] = useState<"providers" | "models" | "defaults">("providers");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/models");
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
      if (data.models) setModels(data.models);
    } catch {
      toast.error("加载模型配置失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === 提供商 CRUD ===

  const handleSaveProvider = async () => {
    if (!editingProvider) return;
    if (!editingProvider.name || !editingProvider.base_url || (!editingProvider.isNew && !editingProvider.api_key && editingProvider.api_key !== undefined)) {
      toast.error("名称、Base URL 和 API Key 为必填项");
      return;
    }
    if (editingProvider.isNew && !editingProvider.api_key) {
      toast.error("API Key 为必填项");
      return;
    }

    setSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const url = "/api/admin/models";
      const body = {
        action: editingProvider.isNew ? "add_provider" : undefined,
        target: editingProvider.isNew ? undefined : "provider",
        ...(editingProvider.isNew
          ? {
              name: editingProvider.name,
              type: editingProvider.type || "openai",
              base_url: editingProvider.base_url,
              api_key: editingProvider.api_key,
              enabled: editingProvider.enabled ?? 1,
            }
          : {
              id: editingProvider.id,
              name: editingProvider.name,
              type: editingProvider.type,
              base_url: editingProvider.base_url,
              api_key: editingProvider.api_key || "",
              enabled: editingProvider.enabled ?? 1,
            }),
      };

      const method = editingProvider.isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingProvider.isNew ? "提供商已创建" : "提供商已更新");
        setEditingProvider(null);
        fetchData();
      } else {
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handleDeleteProvider = async (id: number) => {
    if (!confirm("删除提供商会同时删除其下所有模型，确定要删除吗？")) return;
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/models?target=provider&id=${id}`, {
        method: "DELETE",
        headers: csrfHeaders,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("提供商已删除");
        fetchData();
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleTestApiKey = async (provider: Partial<Provider>) => {
    if (!provider.base_url || !provider.api_key) {
      toast.error("请先填写 Base URL 和 API Key");
      return;
    }
    setTestingId(provider.id || -1);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          action: "test_api_key",
          base_url: provider.base_url,
          api_key: provider.api_key,
          type: provider.type || "openai",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "API Key 验证成功");
      } else {
        toast.error(data.error || "验证失败");
      }
    } catch {
      toast.error("测试请求失败");
    }
    setTestingId(null);
  };

  const handleDiscoverModels = async (providerId: number) => {
    setDiscoveringId(providerId);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ action: "test_and_add", provider_id: providerId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.error || "发现模型失败");
      }
    } catch {
      toast.error("请求失败");
    }
    setDiscoveringId(null);
  };

  // === 模型 CRUD ===

  const handleSaveModel = async () => {
    if (!editingModel) return;
    if (!editingModel.provider_id || !editingModel.model_id) {
      toast.error("提供商和模型ID为必填项");
      return;
    }

    setSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const method = editingModel.isNew ? "POST" : "PATCH";
      const body = editingModel.isNew
        ? {
            action: "add_model",
            provider_id: editingModel.provider_id,
            model_id: editingModel.model_id,
            display_name: editingModel.display_name || editingModel.model_id,
            model_type: editingModel.model_type || "chat",
            enabled: editingModel.enabled ?? 1,
            max_tokens: editingModel.max_tokens || 4096,
          }
        : {
            target: "model",
            id: editingModel.id,
            model_id: editingModel.model_id,
            display_name: editingModel.display_name || editingModel.model_id,
            model_type: editingModel.model_type || "chat",
            enabled: editingModel.enabled ?? 1,
            max_tokens: editingModel.max_tokens || 4096,
          };

      const res = await fetch("/api/admin/models", {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingModel.isNew ? "模型已添加" : "模型已更新");
        setEditingModel(null);
        fetchData();
      } else {
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handleDeleteModel = async (id: number) => {
    if (!confirm("确定要删除此模型吗？")) return;
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/models?target=model&id=${id}`, {
        method: "DELETE",
        headers: csrfHeaders,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("模型已删除");
        fetchData();
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleSetDefault = async (modelId: number, modelType: string) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ action: "set_default", model_id: modelId, model_type: modelType }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("默认模型已设置");
        fetchData();
      } else {
        toast.error(data.error || "设置失败");
      }
    } catch {
      toast.error("设置失败");
    }
  };

  const handleToggleProviderEnabled = async (provider: Provider) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          target: "provider",
          id: provider.id,
          name: provider.name,
          type: provider.type,
          base_url: provider.base_url,
          enabled: provider.enabled ? 0 : 1,
        }),
      });
      if (res.ok) fetchData();
    } catch {
      toast.error("切换状态失败");
    }
  };

  const handleToggleModelEnabled = async (model: Model) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          target: "model",
          id: model.id,
          model_id: model.model_id,
          display_name: model.display_name,
          model_type: model.model_type,
          enabled: model.enabled ? 0 : 1,
          max_tokens: model.max_tokens,
        }),
      });
      if (res.ok) fetchData();
    } catch {
      toast.error("切换状态失败");
    }
  };

  const getModelTypeLabel = (type: string) => MODEL_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
  const getModelTypeIcon = (type: string) => MODEL_TYPE_OPTIONS.find((o) => o.value === type)?.icon || "📦";
  const getProviderTypeLabel = (type: string) => PROVIDER_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;

  /* ==================== 渲染 ==================== */

  return (
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6" />
            模型管理
          </h2>
          <p className="text-muted-foreground mt-1">
            管理AI模型提供商和模型配置，为机器人提供对话和图片生成能力
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
      </div>

      {/* 切换标签 */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: "providers", label: "提供商", icon: <Server className="w-4 h-4" /> },
          { id: "models", label: "模型列表", icon: <Sparkles className="w-4 h-4" /> },
          { id: "defaults", label: "默认模型", icon: <Star className="w-4 h-4" /> },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeSection === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSection(tab.id as any)}
          >
            {tab.icon}
            <span className="ml-1">{tab.label}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* === 提供商管理 === */}
          {activeSection === "providers" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setEditingProvider({ type: "openai", base_url: DEFAULT_BASE_URLS.openai, enabled: 1, isNew: true })}>
                  <Plus className="w-4 h-4 mr-1" />
                  新增提供商
                </Button>
              </div>

              {providers.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">暂无模型提供商</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      点击「新增提供商」配置 OpenAI、Anthropic 等 AI 服务
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {providers.map((provider) => (
                    <Card key={provider.id} className={!provider.enabled ? "opacity-60" : ""}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">{PROVIDER_TYPE_OPTIONS.find((o) => o.value === provider.type)?.icon || "🔗"}</span>
                              <h3 className="font-semibold text-lg">{provider.name}</h3>
                              <Badge variant={provider.enabled ? "default" : "secondary"}>
                                {provider.enabled ? "已启用" : "已禁用"}
                              </Badge>
                              <Badge variant="outline">{getProviderTypeLabel(provider.type)}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p className="truncate">Base URL: {provider.base_url}</p>
                              <p>API Key: {provider.api_key || "未配置"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleProviderEnabled(provider)}
                              title={provider.enabled ? "禁用" : "启用"}
                            >
                              {provider.enabled ? (
                                <ToggleRight className="w-5 h-5 text-green-500" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDiscoverModels(provider.id)}
                              disabled={discoveringId === provider.id || !provider.enabled}
                              title="一键发现并添加可用模型"
                            >
                              {discoveringId === provider.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Wand2 className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingProvider({ ...provider, isNew: false })}
                              title="编辑"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProvider(provider.id)}
                              title="删除"
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === 模型列表 === */}
          {activeSection === "models" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setEditingModel({ model_type: "chat", enabled: 1, max_tokens: 4096, isNew: true })}>
                  <Plus className="w-4 h-4 mr-1" />
                  手动添加模型
                </Button>
              </div>

              {models.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">暂无模型配置</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      在提供商页面使用「一键发现」自动添加，或点击「手动添加」
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {["chat", "image", "embedding"].map((type) => {
                    const typeModels = models.filter((m) => m.model_type === type);
                    if (typeModels.length === 0) return null;
                    return (
                      <div key={type}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          {getModelTypeIcon(type)} {getModelTypeLabel(type)} ({typeModels.length})
                        </h3>
                        <div className="grid gap-3">
                          {typeModels.map((model) => (
                            <Card key={model.id} className={!model.enabled ? "opacity-60" : ""}>
                              <CardContent className="py-3 px-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {model.is_default === 1 && (
                                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium truncate">{model.display_name || model.model_id}</span>
                                        <Badge variant="outline" className="text-xs">{model.model_id}</Badge>
                                        {model.is_default === 1 && <Badge className="text-xs bg-yellow-500">默认</Badge>}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        提供商: {model.provider_name || "未知"} | Max Tokens: {model.max_tokens}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleToggleModelEnabled(model)}
                                      title={model.enabled ? "禁用" : "启用"}
                                    >
                                      {model.enabled ? (
                                        <ToggleRight className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                                      )}
                                    </Button>
                                    {model.is_default !== 1 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleSetDefault(model.id, model.model_type)}
                                        title="设为默认"
                                      >
                                        <Star className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingModel({ ...model, isNew: false })}
                                      title="编辑"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteModel(model.id)}
                                      title="删除"
                                      className="text-red-500 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === 默认模型设置 === */}
          {activeSection === "defaults" && (() => {
            const chatModels = models.filter((m) => m.model_type === "chat" && m.enabled);
            const imageModels = models.filter((m) => m.model_type === "image" && m.enabled);
            const defaultChatModel = chatModels.find((m) => m.is_default === 1);
            const defaultImageModel = imageModels.find((m) => m.is_default === 1);
            return (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    对话模型
                  </CardTitle>
                  <CardDescription>机器人回复消息时使用的默认模型</CardDescription>
                </CardHeader>
                <CardContent>
                  {chatModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无可用的对话模型，请先添加</p>
                  ) : (
                    <Select
                      value={defaultChatModel ? String(defaultChatModel.id) : ""}
                      onValueChange={(v) => handleSetDefault(Number(v), "chat")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择默认对话模型">
                          {(value: string | null) => {
                            if (!value) return "选择默认对话模型";
                            const m = chatModels.find((m) => String(m.id) === value);
                            return m ? `${m.display_name || m.model_id} (${m.provider_name || "未知"})` : value;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {chatModels.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.display_name || m.model_id} ({m.provider_name || "未知"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    图片生成模型
                  </CardTitle>
                  <CardDescription>AI 生成壁纸时使用的默认模型</CardDescription>
                </CardHeader>
                <CardContent>
                  {imageModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无可用的图片生成模型，请先添加</p>
                  ) : (
                    <Select
                      value={defaultImageModel ? String(defaultImageModel.id) : ""}
                      onValueChange={(v) => handleSetDefault(Number(v), "image")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择默认图片生成模型">
                          {(value: string | null) => {
                            if (!value) return "选择默认图片生成模型";
                            const m = imageModels.find((m) => String(m.id) === value);
                            return m ? `${m.display_name || m.model_id} (${m.provider_name || "未知"})` : value;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {imageModels.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.display_name || m.model_id} ({m.provider_name || "未知"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>
            </div>
          );
          })()}
        </>
      )}

      {/* === 编辑提供商弹窗 === */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                {editingProvider.isNew ? "新增提供商" : "编辑提供商"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>名称 *</Label>
                  <Input
                    value={editingProvider.name || ""}
                    onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                    placeholder="如: OpenAI、智谱AI"
                  />
                </div>
                <div className="space-y-2">
                  <Label>类型 *</Label>
                  <Select
                    value={editingProvider.type || "openai"}
                    onValueChange={(v) => { if (!v) return; setEditingProvider({ ...editingProvider, type: v, base_url: DEFAULT_BASE_URLS[v] || editingProvider.base_url || "" }) }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.icon} {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Base URL *</Label>
                <Input
                  value={editingProvider.base_url || ""}
                  onChange={(e) => setEditingProvider({ ...editingProvider, base_url: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
                <p className="text-xs text-muted-foreground">OpenAI 兼容 API 的基础地址</p>
              </div>

              <div className="space-y-2">
                <Label>API Key {editingProvider.isNew ? "*" : "(留空保留原值)"}</Label>
                <Input
                  type="password"
                  value={editingProvider.api_key || ""}
                  onChange={(e) => setEditingProvider({ ...editingProvider, api_key: e.target.value })}
                  placeholder="sk-..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Label>启用</Label>
                <button onClick={() => setEditingProvider({ ...editingProvider, enabled: editingProvider.enabled ? 0 : 1 })} className="text-2xl">
                  {editingProvider.enabled ? (
                    <ToggleRight className="w-8 h-8 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingProvider(null)} disabled={saving}>
                  <X className="w-4 h-4 mr-1" />取消
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleTestApiKey(editingProvider)}
                  disabled={testingId !== null || !editingProvider.base_url || !editingProvider.api_key}
                >
                  {testingId !== null ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Key className="w-4 h-4 mr-1" />}
                  测试Key
                </Button>
                <Button onClick={handleSaveProvider} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === 编辑模型弹窗 === */}
      {editingModel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {editingModel.isNew ? "手动添加模型" : "编辑模型"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingModel.isNew && (
                <div className="space-y-2">
                  <Label>提供商 *</Label>
                  <Select
                    value={String(editingModel.provider_id || "")}
                    onValueChange={(v) => setEditingModel({ ...editingModel, provider_id: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择提供商">
                        {(value: string | null) => {
                          if (!value) return "选择提供商";
                          const p = providers.find((p) => String(p.id) === value);
                          return p?.name || value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {providers.filter((p) => p.enabled).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>模型 ID *</Label>
                <Input
                  value={editingModel.model_id || ""}
                  onChange={(e) => setEditingModel({ ...editingModel, model_id: e.target.value })}
                  placeholder="如: gpt-4o, claude-3-opus-20240229"
                />
              </div>

              <div className="space-y-2">
                <Label>显示名称</Label>
                <Input
                  value={editingModel.display_name || ""}
                  onChange={(e) => setEditingModel({ ...editingModel, display_name: e.target.value })}
                  placeholder="如: GPT-4o, Claude 3 Opus"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>模型类型</Label>
                  <Select
                    value={editingModel.model_type || "chat"}
                    onValueChange={(v) => setEditingModel({ ...editingModel, model_type: v as string })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.icon} {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={editingModel.max_tokens || 4096}
                    onChange={(e) => setEditingModel({ ...editingModel, max_tokens: Number(e.target.value) })}
                    min={1}
                    max={200000}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label>启用</Label>
                <button onClick={() => setEditingModel({ ...editingModel, enabled: editingModel.enabled ? 0 : 1 })} className="text-2xl">
                  {editingModel.enabled ? (
                    <ToggleRight className="w-8 h-8 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingModel(null)} disabled={saving}>
                  <X className="w-4 h-4 mr-1" />取消
                </Button>
                <Button onClick={handleSaveModel} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  保存
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div>
            <p className="font-medium text-foreground">快速开始</p>
            <p>1. 新增一个模型提供商，填写 Base URL 和 API Key</p>
            <p>2. 点击提供商卡片上的「魔杖」按钮，一键发现并添加可用模型</p>
            <p>3. 在「默认模型」页面设置对话和图片生成的默认模型</p>
          </div>
          <div>
            <p className="font-medium text-foreground">飞书机器人对话</p>
            <p>配置好对话模型后，飞书应用需要开启「接收消息」事件订阅</p>
            <p>事件订阅 URL: <code className="bg-muted px-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/bot/feishu/event</code></p>
            <p>订阅事件: <code className="bg-muted px-1 rounded">im.message.receive_v1</code></p>
          </div>
          <div>
            <p className="font-medium text-foreground">支持的提供商类型</p>
            <p><b>OpenAI 兼容</b>：OpenAI、DeepSeek、智谱AI、月之暗面等兼容 OpenAI API 的服务商</p>
            <p><b>Anthropic</b>：Claude 系列模型</p>
            <p><b>自定义</b>：任何兼容 OpenAI API 格式的服务</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}