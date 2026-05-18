"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Plus,
  Trash2,
  Send,
  RefreshCw,
  Edit3,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wifi,
  Cable,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  ChevronLeft,
  ChevronRight,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ==================== 类型定义 ==================== */

type BotType = "feishu" | "qq" | "dingtalk" | "wechat_work" | "slack" | "custom";
type AuthMode = "webhook" | "app";

interface BotConfig {
  id: number;
  name: string;
  type: BotType;
  auth_mode: AuthMode;
  app_id: string | null;
  app_secret: string | null;
  chat_id: string | null;
  webhook_url: string;
  secret: string | null;
  enabled: number;
  subscribe_events: string[] | null;
  feishu_msg_type: string;
  qq_group_id: string | null;
  custom_method: string;
  custom_headers: Record<string, string> | null;
  custom_body_template: string | null;
  default_chat_model_id: number | null;
  default_image_model_id: number | null;
  last_sent_at: string | null;
  send_count: number;
  fail_count: number;
  created_at: string;
  updated_at: string;
}

const BOT_TYPE_OPTIONS: { value: BotType; label: string; icon: string }[] = [
  { value: "feishu", label: "飞书", icon: "🐦" },
  { value: "qq", label: "QQ", icon: "🐧" },
  { value: "dingtalk", label: "钉钉", icon: "🔵" },
  { value: "wechat_work", label: "企业微信", icon: "💬" },
  { value: "slack", label: "Slack", icon: "📱" },
  { value: "custom", label: "自定义", icon: "🔗" },
];

const EVENT_OPTIONS = [
  { value: "system", label: "系统通知" },
  { value: "review", label: "审核" },
  { value: "achievement", label: "成就" },
  { value: "comment", label: "评论" },
  { value: "follow", label: "关注" },
  { value: "favorite", label: "收藏" },
  { value: "like", label: "点赞" },
  { value: "crawl", label: "爬取" },
  { value: "upload", label: "上传" },
];

const EMPTY_BOT: Omit<BotConfig, "id" | "last_sent_at" | "send_count" | "fail_count" | "created_at" | "updated_at"> = {
  name: "",
  type: "feishu",
  auth_mode: "webhook",
  app_id: null,
  app_secret: null,
  chat_id: null,
  webhook_url: "",
  secret: null,
  enabled: 1,
  subscribe_events: null,
  feishu_msg_type: "interactive",
  qq_group_id: null,
  custom_method: "POST",
  custom_headers: null,
  custom_body_template: null,
  default_chat_model_id: null,
  default_image_model_id: null,
};

/* ==================== 长连接状态类型 ==================== */

interface WsClientStatus {
  status: "disconnected" | "connecting" | "connected" | "error";
  appId: string;
  connectedAt: string | null;
  lastEventAt: string | null;
  error: string | null;
  eventCount: number;
}

/* ==================== 消息留痕类型 ==================== */

interface BotMessage {
  id: number;
  bot_config_id: number;
  direction: "outbound" | "inbound";
  platform: string;
  chat_id: string | null;
  sender_id: string | null;
  sender_name: string | null;
  message_type: string;
  title: string | null;
  content: string | null;
  event_type: string | null;
  status: "success" | "failed" | "pending";
  error_message: string | null;
  created_at: string;
  bot_name: string | null;
}

const EVENT_TYPE_LABELS_MSG: Record<string, string> = {
  system: "系统通知", like: "点赞", comment: "评论", review: "审核",
  follow: "关注", achievement: "成就", favorite: "收藏", crawl: "爬取", upload: "上传", chat: "对话",
};

const PLATFORM_ICONS: Record<string, string> = {
  feishu: "🐦", qq: "🐧", dingtalk: "🔵", wechat_work: "💬", slack: "📱", custom: "🔗",
};

export default function BotsTab() {
  const [bots, setBots] = useState<BotConfig[]>([]);
  const [wsStatuses, setWsStatuses] = useState<WsClientStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBot, setEditingBot] = useState<Partial<BotConfig> & { isNew?: boolean } | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // 消息留痕面板
  const [messageBotId, setMessageBotId] = useState<number | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [msgPagination, setMsgPagination] = useState({ page: 1, total_pages: 0, total: 0 });
  const [msgFilter, setMsgFilter] = useState<{ direction?: string; event_type?: string }>({});
  const [msgLoading, setMsgLoading] = useState(false);

  // 判断当前编辑的机器人是否需要 chat_id（仅飞书和QQ的App模式需要）
  const needsChatId = editingBot?.auth_mode === "app" && (editingBot.type === "feishu" || editingBot.type === "qq");

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bots");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBots(data);
      }
    } catch {
      toast.error("加载机器人配置失败");
    }
    // 获取飞书长连接状态
    try {
      const wsRes = await fetch("/api/admin/bots/feishu-ws-status");
      const wsData = await wsRes.json();
      if (wsData.clients) {
        setWsStatuses(wsData.clients);
      }
    } catch {
      // 长连接状态获取失败不影响主流程
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleSave = async () => {
    if (!editingBot) return;
    if (!editingBot.name || !editingBot.type) {
      toast.error("名称和类型为必填项");
      return;
    }
    if (editingBot.auth_mode === "webhook" && !editingBot.webhook_url) {
      toast.error("Webhook 模式下 Webhook 地址为必填项");
      return;
    }
    if (editingBot.auth_mode === "app" && (!editingBot.app_id || !editingBot.app_secret)) {
      toast.error("App API 模式下 App ID 和 App Secret 为必填项");
      return;
    }
    // 仅QQ的App模式需要chat_id（飞书长连接模式自动获取）
    if (needsChatId && editingBot.type === "qq" && !editingBot.chat_id) {
      toast.error("QQ App 模式下 Chat ID 为必填项");
      return;
    }

    setSaving(true);
    try {
      const url = "/api/admin/bots";
      const method = editingBot.isNew ? "POST" : "PATCH";
      const body = { ...editingBot };
      delete (body as any).isNew;
      delete (body as any).last_sent_at;
      delete (body as any).send_count;
      delete (body as any).fail_count;
      delete (body as any).created_at;
      delete (body as any).updated_at;

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingBot.isNew ? "机器人已创建" : "机器人已更新");
        setEditingBot(null);
        fetchBots();
      } else {
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("保存失败");
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此机器人配置吗？")) return;

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/bots?id=${id}`, { method: "DELETE", headers: csrfHeaders });
      const data = await res.json();
      if (res.ok) {
        toast.success("已删除");
        fetchBots();
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/bots/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("测试消息发送成功，请检查机器人是否收到");
      } else {
        toast.error(data.error || "发送失败");
      }
    } catch {
      toast.error("测试发送失败");
    }
    setTestingId(null);
    fetchBots();
  };

  const handleConnectivity = async (id: number) => {
    setConnectingId(id);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/bots/connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`连通性测试成功${data.latency ? `（延迟 ${data.latency}ms）` : ""}`);
      } else {
        toast.error(data.error || "连通性测试失败");
      }
    } catch {
      toast.error("连通性测试请求失败");
    }
    setConnectingId(null);
  };

  const handleToggleEnabled = async (bot: BotConfig) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/bots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ...bot, enabled: bot.enabled ? 0 : 1 }),
      });
      if (res.ok) {
        fetchBots();
      }
    } catch {
      toast.error("切换状态失败");
    }
  };

  const toggleEvent = (event: string) => {
    if (!editingBot) return;
    const current = editingBot.subscribe_events || [];
    const updated = current.includes(event)
      ? current.filter((e) => e !== event)
      : [...current, event];
    setEditingBot({ ...editingBot, subscribe_events: updated.length > 0 ? updated : null });
  };

  const getBotTypeLabel = (type: BotType) => {
    return BOT_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
  };

  const getBotTypeIcon = (type: BotType) => {
    return BOT_TYPE_OPTIONS.find((o) => o.value === type)?.icon || "🤖";
  };

  /* ==================== 消息留痕 ==================== */

  const fetchMessages = useCallback(async (botId: number, page = 1) => {
    setMsgLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      params.set("bot_config_id", String(botId));
      if (msgFilter.direction) params.set("direction", msgFilter.direction);
      if (msgFilter.event_type) params.set("event_type", msgFilter.event_type);
      const res = await fetch(`/api/admin/bot-messages?${params}`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
        setMsgPagination(data.pagination || { page: 1, total_pages: 0, total: 0 });
      }
    } catch {
      toast.error("加载消息记录失败");
    }
    setMsgLoading(false);
  }, [msgFilter]);

  const openMessagePanel = (botId: number) => {
    setMessageBotId(botId);
    setMsgFilter({});
    fetchMessages(botId, 1);
  };

  const closeMessagePanel = () => {
    setMessageBotId(null);
    setMessages([]);
  };

  const renderMessagePanel = () => {
    const bot = messageBotId !== null ? bots.find((b) => b.id === messageBotId) : null;

    return (
      <Dialog open={messageBotId !== null} onOpenChange={(open) => { if (!open) closeMessagePanel(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              消息留痕 — {bot ? `${getBotTypeIcon(bot.type)} ${bot.name}` : `Bot #${messageBotId}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              查看机器人发送和接收的消息记录
            </DialogDescription>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* 方向筛选 */}
              <Select
                value={msgFilter.direction || "all"}
                onValueChange={(v) => {
                  const dir = v === "all" ? undefined : v;
                  const newFilter = { direction: dir, event_type: msgFilter.event_type } as typeof msgFilter;
                  setMsgFilter(newFilter);
                  if (messageBotId !== null) {
                    (async () => {
                      setMsgLoading(true);
                      try {
                        const params = new URLSearchParams({ page: "1", page_size: "20" });
                        params.set("bot_config_id", String(messageBotId));
                        if (newFilter.direction) params.set("direction", newFilter.direction);
                        if (newFilter.event_type) params.set("event_type", newFilter.event_type);
                        const res = await fetch(`/api/admin/bot-messages?${params}`);
                        const data = await res.json();
                        if (res.ok) {
                          setMessages(data.messages || []);
                          setMsgPagination(data.pagination || { page: 1, total_pages: 0, total: 0 });
                        }
                      } catch { /* ignore */ }
                      setMsgLoading(false);
                    })();
                  }
                }}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方向</SelectItem>
                  <SelectItem value="outbound">发送 (outbound)</SelectItem>
                  <SelectItem value="inbound">接收 (inbound)</SelectItem>
                </SelectContent>
              </Select>
              {/* 事件类型筛选 */}
              <Select
                value={msgFilter.event_type || "all"}
                onValueChange={(v) => {
                  const et = v === "all" ? undefined : v;
                  const newFilter = { direction: msgFilter.direction, event_type: et } as typeof msgFilter;
                  setMsgFilter(newFilter);
                  if (messageBotId !== null) {
                    (async () => {
                      setMsgLoading(true);
                      try {
                        const params = new URLSearchParams({ page: "1", page_size: "20" });
                        params.set("bot_config_id", String(messageBotId));
                        if (newFilter.direction) params.set("direction", newFilter.direction);
                        if (newFilter.event_type) params.set("event_type", newFilter.event_type);
                        const res = await fetch(`/api/admin/bot-messages?${params}`);
                        const data = await res.json();
                        if (res.ok) {
                          setMessages(data.messages || []);
                          setMsgPagination(data.pagination || { page: 1, total_pages: 0, total: 0 });
                        }
                      } catch { /* ignore */ }
                      setMsgLoading(false);
                    })();
                  }
                }}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="事件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部事件</SelectItem>
                  {Object.entries(EVENT_TYPE_LABELS_MSG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">
                共 {msgPagination.total} 条记录
              </span>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-2">
            {msgLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>暂无消息记录</p>
              </div>
            ) : (
              <ScrollArea className="h-[55vh]">
                <div className="space-y-3 pr-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg border ${
                        msg.direction === "outbound"
                          ? "bg-blue-50/50 border-blue-200/50 dark:bg-blue-950/20 dark:border-blue-800/30"
                          : "bg-green-50/50 border-green-200/50 dark:bg-green-950/20 dark:border-green-800/30"
                      }`}
                    >
                      {/* 消息头部 */}
                      <div className="flex items-center gap-2 mb-1.5">
                        {msg.direction === "outbound" ? (
                          <ArrowUpRight className="w-4 h-4 text-blue-500" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.direction === "outbound" ? "发送" : "接收"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {PLATFORM_ICONS[msg.platform] || "🤖"} {msg.platform}
                        </Badge>
                        {msg.event_type && (
                          <Badge variant="secondary" className="text-xs">
                            {EVENT_TYPE_LABELS_MSG[msg.event_type] || msg.event_type}
                          </Badge>
                        )}
                        {msg.status === "failed" && (
                          <Badge variant="destructive" className="text-xs">失败</Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(msg.created_at).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      {/* 发送者信息 */}
                      {(msg.sender_name || msg.sender_id) && (
                        <div className="text-xs text-muted-foreground mb-1">
                          发送者: {msg.sender_name || msg.sender_id}
                        </div>
                      )}
                      {/* 消息标题 */}
                      {msg.title && (
                        <div className="font-medium text-sm mb-0.5">{msg.title}</div>
                      )}
                      {/* 消息内容 */}
                      {msg.content && (
                        <div className="text-sm text-foreground/80 whitespace-pre-wrap break-words line-clamp-4">
                          {msg.content}
                        </div>
                      )}
                      {/* 错误信息 */}
                      {msg.error_message && (
                        <div className="text-xs text-red-500 mt-1">
                          错误: {msg.error_message}
                        </div>
                      )}
                      {/* 群聊ID */}
                      {msg.chat_id && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Chat: {msg.chat_id}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          {/* 分页 */}
          {msgPagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 px-6 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={msgPagination.page <= 1 || msgLoading}
                onClick={() => messageBotId && fetchMessages(messageBotId, msgPagination.page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {msgPagination.page} / {msgPagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={msgPagination.page >= msgPagination.total_pages || msgLoading}
                onClick={() => messageBotId && fetchMessages(messageBotId, msgPagination.page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  /* ==================== 编辑表单 ==================== */

  const renderEditForm = () => {
    if (!editingBot) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {editingBot.isNew ? "新增机器人" : "编辑机器人"}
            </CardTitle>
            <CardDescription>
              配置飞书、QQ、钉钉等机器人，将站内通知推送到群聊
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>名称 *</Label>
                <Input
                  value={editingBot.name || ""}
                  onChange={(e) => setEditingBot({ ...editingBot, name: e.target.value })}
                  placeholder="如：飞书通知群"
                />
              </div>
              <div className="space-y-2">
                <Label>类型 *</Label>
                <Select
                  value={editingBot.type || "feishu"}
                  onValueChange={(v) => setEditingBot({ ...editingBot, type: v as BotType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 认证模式 */}
            <div className="space-y-2">
              <Label>认证模式 *</Label>
              <Select
                value={editingBot.auth_mode || "webhook"}
                onValueChange={(v) => setEditingBot({ ...editingBot, auth_mode: v as AuthMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook 模式（群自定义机器人）</SelectItem>
                  <SelectItem value="app">App API 模式（开放平台应用）</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {editingBot.auth_mode === "app"
                  ? "通过 App ID + App Secret 获取 access_token，调用官方 API 发送消息到指定群/频道"
                  : "通过群聊中的自定义机器人 Webhook 地址直接推送消息"}
              </p>
            </div>

            {/* App API 模式配置 */}
            {editingBot.auth_mode === "app" && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm font-medium">开放平台应用配置</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>App ID *</Label>
                    <Input
                      value={editingBot.app_id || ""}
                      onChange={(e) => setEditingBot({ ...editingBot, app_id: e.target.value || null })}
                      placeholder={
                        editingBot.type === "feishu"
                          ? "cli_a5xxxxxxxxxxxx"
                          : editingBot.type === "qq"
                          ? "1020xxxxxx"
                          : "应用ID"
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>App Secret *</Label>
                    <Input
                      type="password"
                      value={editingBot.app_secret || ""}
                      onChange={(e) => setEditingBot({ ...editingBot, app_secret: e.target.value || null })}
                      placeholder="应用密钥"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Chat ID</Label>
                  <Input
                    value={editingBot.chat_id || ""}
                    onChange={(e) => setEditingBot({ ...editingBot, chat_id: e.target.value || null })}
                    placeholder={
                      editingBot.type === "feishu"
                        ? "oc_a0553eee9024c1e8f2d5040dc5cddddg（可选，长连接模式自动获取）"
                        : editingBot.type === "qq"
                        ? "频道/群 channel_id"
                        : "会话ID（可选）"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingBot.type === "feishu"
                      ? "飞书群的 chat_id，可在群设置 → 更多信息中获取。长连接模式下可选，消息事件会自动携带 chat_id"
                      : editingBot.type === "qq"
                      ? "QQ 频道/群的 channel_id"
                      : "目标会话的唯一标识（部分平台可选）"}
                  </p>
                </div>
              </div>
            )}

            {/* Webhook 模式配置 */}
            {editingBot.auth_mode === "webhook" && (
              <>
            <div className="space-y-2">
              <Label>Webhook 地址 *</Label>
              <Input
                value={editingBot.webhook_url || ""}
                onChange={(e) => setEditingBot({ ...editingBot, webhook_url: e.target.value })}
                placeholder={
                  editingBot.type === "feishu"
                    ? "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                    : editingBot.type === "qq"
                    ? "https://q.qq.com/wiki/xxx"
                    : editingBot.type === "dingtalk"
                    ? "https://oapi.dingtalk.com/robot/send?access_token=xxx"
                    : editingBot.type === "wechat_work"
                    ? "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                    : "https://hooks.example.com/xxx"
                }
              />
            </div>

            <div className="space-y-2">
              <Label>签名密钥</Label>
              <Input
                type="password"
                value={editingBot.secret || ""}
                onChange={(e) => setEditingBot({ ...editingBot, secret: e.target.value || null })}
                placeholder="飞书/钉钉机器人的签名密钥（可选）"
              />
              <p className="text-xs text-muted-foreground">
                飞书和钉钉机器人需要在安全设置中配置签名验证
              </p>
            </div>
              </>
            )}

            <Separator />

            {/* 事件订阅 */}
            <div className="space-y-2">
              <Label>订阅事件</Label>
              <p className="text-xs text-muted-foreground">
                不选则接收所有类型通知
              </p>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((event) => {
                  const isSelected = editingBot.subscribe_events?.includes(event.value) || false;
                  return (
                    <Badge
                      key={event.value}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleEvent(event.value)}
                    >
                      {isSelected && <Check className="w-3 h-3 mr-1" />}
                      {event.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* 飞书专属配置 */}
            {editingBot.type === "feishu" && (
              <div className="space-y-2">
                <Label>飞书消息类型</Label>
                <Select
                  value={editingBot.feishu_msg_type || "interactive"}
                  onValueChange={(v) => setEditingBot({ ...editingBot, feishu_msg_type: v ?? "interactive" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interactive">卡片消息（推荐）</SelectItem>
                    <SelectItem value="text">纯文本</SelectItem>
                    <SelectItem value="post">富文本</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* QQ 专属配置 */}
            {editingBot.type === "qq" && (
              <div className="space-y-2">
                <Label>QQ 群号</Label>
                <Input
                  value={editingBot.qq_group_id || ""}
                  onChange={(e) => setEditingBot({ ...editingBot, qq_group_id: e.target.value || null })}
                  placeholder="群机器人时填写群号"
                />
              </div>
            )}

            {/* 自定义 Webhook 配置 */}
            {editingBot.type === "custom" && (
              <>
                <div className="space-y-2">
                  <Label>请求方法</Label>
                  <Select
                    value={editingBot.custom_method || "POST"}
                    onValueChange={(v) => setEditingBot({ ...editingBot, custom_method: v ?? "POST" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>自定义请求头 (JSON)</Label>
                  <Textarea
                    value={editingBot.custom_headers ? JSON.stringify(editingBot.custom_headers) : ""}
                    onChange={(e) => {
                      try {
                        const parsed = e.target.value ? JSON.parse(e.target.value) : null;
                        setEditingBot({ ...editingBot, custom_headers: parsed });
                      } catch {
                        // JSON 解析失败时不更新
                      }
                    }}
                    placeholder='{"Authorization": "Bearer xxx"}'
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>请求体模板</Label>
                  <Textarea
                    value={editingBot.custom_body_template || ""}
                    onChange={(e) => setEditingBot({ ...editingBot, custom_body_template: e.target.value || null })}
                    placeholder={'{"text": "{{title}}\\n{{content}}"}'}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    支持变量: {`{{title}}`}, {`{{content}}`}, {`{{type}}`}, {`{{timestamp}}`}
                  </p>
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center gap-2">
              <Label>启用</Label>
              <button
                onClick={() => setEditingBot({ ...editingBot, enabled: editingBot.enabled ? 0 : 1 })}
                className="text-2xl"
              >
                {editingBot.enabled ? (
                  <ToggleRight className="w-8 h-8 text-green-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingBot(null)}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  /* ==================== 机器人列表 ==================== */

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            机器人通知
          </h2>
          <p className="text-muted-foreground mt-1">
            配置飞书、QQ、钉钉等机器人，将站内通知实时推送到群聊
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBots}>
            <RefreshCw className="w-4 h-4 mr-1" />
            刷新
          </Button>
          <Button
            onClick={() =>
              setEditingBot({ ...EMPTY_BOT, isNew: true })
            }
          >
            <Plus className="w-4 h-4 mr-1" />
            新增机器人
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : bots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无机器人配置</p>
            <p className="text-sm text-muted-foreground mt-1">
              点击「新增机器人」配置飞书/QQ等通知推送
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bots.map((bot) => (
            <Card key={bot.id} className={!bot.enabled ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getBotTypeIcon(bot.type)}</span>
                      <h3 className="font-semibold text-lg">{bot.name}</h3>
                      <Badge variant={bot.enabled ? "default" : "secondary"}>
                        {bot.enabled ? "已启用" : "已禁用"}
                      </Badge>
                      <Badge variant="outline">{getBotTypeLabel(bot.type)}</Badge>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      {bot.auth_mode === "app" && bot.type === "feishu" ? (() => {
                        const wsStatus = wsStatuses.find((s) => s.appId === bot.app_id);
                        return (
                          <div className="flex items-center gap-2">
                            <Cable className="w-3.5 h-3.5" />
                            <span>长连接:</span>
                            <Badge
                              variant={
                                wsStatus?.status === "connected" ? "default" :
                                wsStatus?.status === "error" ? "destructive" :
                                wsStatus?.status === "connecting" ? "secondary" :
                                "outline"
                              }
                              className="text-xs"
                            >
                              {wsStatus?.status === "connected" ? "已连接" :
                               wsStatus?.status === "connecting" ? "连接中..." :
                               wsStatus?.status === "error" ? "连接错误" :
                               "未连接"}
                            </Badge>
                            {wsStatus?.connectedAt && (
                              <span className="text-xs">
                                自 {new Date(wsStatus.connectedAt).toLocaleString("zh-CN")}
                              </span>
                            )}
                            {wsStatus?.eventCount != null && wsStatus.eventCount > 0 && (
                              <span className="text-xs">
                                事件: {wsStatus.eventCount}
                              </span>
                            )}
                            {wsStatus?.error && (
                              <span className="text-xs text-red-500 truncate max-w-[200px]" title={wsStatus.error}>
                                {wsStatus.error}
                              </span>
                            )}
                          </div>
                        );
                      })() : (
                        <p className="truncate">
                          Webhook: {bot.webhook_url.replace(/key=[^&]+/, "key=***").replace(/access_token=[^&]+/, "access_token=***")}
                        </p>
                      )}

                      {bot.subscribe_events && bot.subscribe_events.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>订阅事件:</span>
                          {bot.subscribe_events.map((e) => (
                            <Badge key={e} variant="outline" className="text-xs">
                              {EVENT_OPTIONS.find((o) => o.value === e)?.label || e}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          成功: {bot.send_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-500" />
                          失败: {bot.fail_count}
                        </span>
                        {bot.last_sent_at && (
                          <span>
                            最后发送: {new Date(bot.last_sent_at).toLocaleString("zh-CN")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleEnabled(bot)}
                      title={bot.enabled ? "禁用" : "启用"}
                    >
                      {bot.enabled ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleConnectivity(bot.id)}
                      disabled={connectingId === bot.id}
                      title="测试连通性"
                    >
                      {connectingId === bot.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTest(bot.id)}
                      disabled={testingId === bot.id || !bot.enabled}
                      title="发送测试消息"
                    >
                      {testingId === bot.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openMessagePanel(bot.id)}
                      title="消息留痕"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingBot({ ...bot, isNew: false })}
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(bot.id)}
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

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div>
            <p className="font-medium text-foreground">认证模式说明</p>
            <p><b>Webhook 模式</b>：在群聊中添加自定义机器人，获取 Webhook 地址即可推送消息（简单快速，适合单群通知）</p>
            <p><b>App API 模式</b>：在开放平台创建应用，使用 App ID + App Secret 认证后调用官方 API（功能完整，可发文件、@人、指定群）</p>
          </div>
          <div>
            <p className="font-medium text-foreground">飞书机器人</p>
            <p>Webhook：群设置 → 添加自定义机器人 → 复制 Webhook 地址</p>
            <p>App API（长连接模式）：飞书开放平台 → 创建企业自建应用 → 添加机器人能力 → 获取 App ID 和 App Secret → 事件订阅选择「使用长连接接收」→ 将机器人添加到目标群</p>
            <p className="text-xs mt-1">App 模式使用长连接（WebSocket）接收事件，无需公网 IP 或域名，本地开发也无需内网穿透</p>
          </div>
          <div>
            <p className="font-medium text-foreground">QQ 群机器人</p>
            <p>Webhook：QQ 开放平台创建机器人 → 配置 Webhook</p>
            <p>App API：QQ 开放平台 → 创建机器人 → 开发设置获取 AppID 和 AppSecret → 配置沙箱群 → 获取 channel_id</p>
          </div>
          <div>
            <p className="font-medium text-foreground">钉钉机器人</p>
            <p>群设置 → 添加自定义机器人 → 安全设置选择「加签」→ 获取 Webhook 地址和签名密钥</p>
          </div>
        </CardContent>
      </Card>

      {renderEditForm()}
      {renderMessagePanel()}
    </div>
  );
}