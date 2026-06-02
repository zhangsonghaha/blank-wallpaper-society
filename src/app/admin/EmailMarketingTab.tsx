"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Mail, Send, Plus, RefreshCw, Eye, Users, Clock, CheckCircle,
  XCircle, Loader2, BarChart3, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { withCsrfHeader } from "@/lib/csrf-client";

interface Campaign {
  id: number;
  subject: string;
  campaign_type: string;
  status: string;
  target_count: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface SubscriptionStats {
  total: number;
  weeklySubscribers: number;
  activitySubscribers: number;
  creatorSubscribers: number;
  unsubscribed: number;
}

const TYPE_LABELS: Record<string, string> = {
  weekly_digest: "每周精选",
  activity_notice: "活动通知",
  creator_update: "创作者动态",
  system: "系统邮件",
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "草稿", className: "bg-gray-100 text-gray-700" },
  scheduled: { label: "已排期", className: "bg-blue-100 text-blue-700" },
  sending: { label: "发送中", className: "bg-yellow-100 text-yellow-700" },
  completed: { label: "已完成", className: "bg-green-100 text-green-700" },
  failed: { label: "失败", className: "bg-red-100 text-red-700" },
};

export default function EmailMarketingTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  // 新建活动表单
  const [formSubject, setFormSubject] = useState("");
  const [formHtml, setFormHtml] = useState("");
  const [formType, setFormType] = useState("system");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/email-marketing/campaigns")
      .then((res) => res.json())
      .then((data) => {
        setCampaigns(data.data || []);
        setStats(data.subscriptionStats || null);
        setLoading(false);
      })
      .catch(() => {
        toast.error("加载数据失败");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateWeekly = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/email-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ action: "generate_weekly" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("生成失败");
    }
    setGenerating(false);
  };

  const handleCreate = async () => {
    if (!formSubject || !formHtml) {
      toast.error("主题和内容不能为空");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/email-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({
          action: "create",
          subject: formSubject,
          bodyHtml: formHtml,
          campaignType: formType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setCreateDialogOpen(false);
        setFormSubject("");
        setFormHtml("");
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("创建失败");
    }
    setCreating(false);
  };

  const handleSend = async (campaignId: number) => {
    if (!confirm("确认发送此营销邮件？")) return;
    setSending(campaignId);
    try {
      const res = await fetch("/api/admin/email-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await withCsrfHeader()) },
        body: JSON.stringify({ action: "send", campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`发送完成: ${data.sentCount}/${data.totalSubscribers}`);
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("发送失败");
    }
    setSending(null);
  };

  const formatDate = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("zh-CN");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Mail className="w-6 h-6" />
          邮件营销
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateWeekly}
            disabled={generating}
            className="rounded-full gap-1"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            生成每周精选
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="rounded-full gap-1"
          >
            <Plus className="w-4 h-4" />
            新建活动
          </Button>
        </div>
      </div>

      {/* 订阅统计 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "总订阅", value: stats.total, icon: <Users className="w-4 h-4" />, color: "bg-blue-100 text-blue-600" },
            { label: "每周精选", value: stats.weeklySubscribers, icon: <Mail className="w-4 h-4" />, color: "bg-green-100 text-green-600" },
            { label: "活动通知", value: stats.activitySubscribers, icon: <Clock className="w-4 h-4" />, color: "bg-purple-100 text-purple-600" },
            { label: "创作者动态", value: stats.creatorSubscribers, icon: <Eye className="w-4 h-4" />, color: "bg-orange-100 text-orange-600" },
            { label: "已退订", value: stats.unsubscribed, icon: <XCircle className="w-4 h-4" />, color: "bg-red-100 text-red-600" },
          ].map((item) => (
            <Card key={item.label} className="rounded-xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${item.color} flex items-center justify-center`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--color-ink)]">{item.value}</p>
                  <p className="text-xs text-[var(--color-mute)]">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 活动列表 */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            营销活动
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-[var(--color-mute)]">加载中...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-mute)]">暂无营销活动</div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const statusInfo = STATUS_STYLES[c.status] || { label: c.status, className: "bg-gray-100 text-gray-700" };
                return (
                  <div key={c.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-card)] border border-[var(--color-hairline)]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[var(--color-ink)] truncate">{c.subject}</span>
                        <Badge className={`rounded-full text-[10px] ${statusInfo.className}`}>{statusInfo.label}</Badge>
                        <Badge variant="outline" className="rounded-full text-[10px]">{TYPE_LABELS[c.campaign_type] || c.campaign_type}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-mute)]">
                        <span>目标: {c.target_count}</span>
                        <span>已发: {c.sent_count}</span>
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {c.open_count}</span>
                        <span>点击: {c.click_count}</span>
                        <span>{formatDate(c.created_at)}</span>
                      </div>
                    </div>
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleSend(c.id)}
                        disabled={sending === c.id}
                        className="rounded-full gap-1 ml-4"
                      >
                        {sending === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        发送
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新建活动对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新建营销活动
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>邮件主题</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="输入邮件主题" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>营销类型</Label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full h-10 rounded-xl border border-[var(--color-hairline)] bg-transparent px-3 text-sm"
              >
                <option value="weekly_digest">每周精选</option>
                <option value="activity_notice">活动通知</option>
                <option value="creator_update">创作者动态</option>
                <option value="system">系统邮件</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>邮件HTML内容</Label>
              <Textarea
                value={formHtml}
                onChange={(e) => setFormHtml(e.target.value)}
                placeholder="输入HTML邮件内容"
                rows={10}
                className="rounded-xl font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-full">取消</Button>
            <Button onClick={handleCreate} disabled={creating} className="rounded-full gap-1">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}