"use client";

import { useState, useEffect, useCallback } from "react";
import { Trophy, Plus, Calendar, Users, Vote, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Challenge {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  start_time: string;
  end_time: string;
  max_submissions: number;
  votes_per_day: number;
  prize_exp: number;
  prize_description: string;
  submission_count: number;
  vote_count: number;
  created_at: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "bg-gray-200 text-gray-700" },
  active: { label: "进行中", color: "bg-green-100 text-green-700" },
  ended: { label: "已结束", color: "bg-yellow-100 text-yellow-700" },
  settled: { label: "已结算", color: "bg-blue-100 text-blue-700" },
};

export default function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    startTime: "",
    endTime: "",
    maxSubmissions: 3,
    votesPerDay: 5,
    prizeExp: 100,
    prizeDescription: "",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    startTime: "",
    endTime: "",
    maxSubmissions: 3,
    votesPerDay: 5,
    prizeExp: 100,
    prizeDescription: "",
    status: "",
  });

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/challenges?status=all&limit=50");
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.data || []);
      }
    } catch (err) {
      console.error("获取挑战赛列表失败:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("请输入活动标题");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          startTime: form.startTime,
          endTime: form.endTime,
          maxSubmissions: form.maxSubmissions,
          votesPerDay: form.votesPerDay,
          prizeExp: form.prizeExp,
          prizeDescription: form.prizeDescription,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("活动创建成功");
        setCreateOpen(false);
        setForm({ title: "", description: "", category: "", startTime: "", endTime: "", maxSubmissions: 3, votesPerDay: 5, prizeExp: 100, prizeDescription: "" });
        fetchChallenges();
      } else {
        toast.error(data.error || "创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (c: Challenge) => {
    setEditingId(c.id);
    setEditForm({
      title: c.title,
      description: c.description || "",
      category: c.category || "",
      startTime: c.start_time ? new Date(c.start_time).toISOString().slice(0, 16) : "",
      endTime: c.end_time ? new Date(c.end_time).toISOString().slice(0, 16) : "",
      maxSubmissions: c.max_submissions || 3,
      votesPerDay: c.votes_per_day || 5,
      prizeExp: c.prize_exp || 100,
      prizeDescription: c.prize_description || "",
      status: c.status,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!editForm.title.trim()) {
      toast.error("请输入活动标题");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/challenges/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          startTime: editForm.startTime,
          endTime: editForm.endTime,
          maxSubmissions: editForm.maxSubmissions,
          votesPerDay: editForm.votesPerDay,
          prizeExp: editForm.prizeExp,
          prizeDescription: editForm.prizeDescription,
          status: editForm.status,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("活动更新成功");
        setEditOpen(false);
        setEditingId(null);
        fetchChallenges();
      } else {
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("更新失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">挑战赛管理</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> 创建活动
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-mute)]" />
        </div>
      ) : challenges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-[var(--color-mute)]">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无挑战赛活动</p>
            <p className="text-sm mt-1">点击"创建活动"按钮开始</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {challenges.map((c) => {
            const statusInfo = statusLabels[c.status] || { label: c.status, color: "bg-gray-200" };
            return (
              <Card key={c.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[var(--color-ink)]">{c.title}</h3>
                        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      </div>
                      {c.description && (
                        <p className="text-sm text-[var(--color-mute)] mt-1 line-clamp-2">{c.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-mute)]">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(c.start_time).toLocaleDateString()} ~ {new Date(c.end_time).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.submission_count} 投稿</span>
                        <span className="flex items-center gap-1"><Vote className="w-3 h-3" /> {c.vote_count} 票</span>
                        {c.category && <span>分类: {c.category}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right text-sm">
                        <div className="text-[var(--color-primary)] font-medium">+{c.prize_exp} EXP</div>
                        <div className="text-xs text-[var(--color-mute)]">每人{c.max_submissions}稿/每日{c.votes_per_day}票</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                        <Pencil className="w-3 h-3 mr-1" /> 编辑
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建活动对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建挑战赛活动</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>活动标题 *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="如：春日风光壁纸大赛" />
            </div>
            <div>
              <Label>活动描述和规则</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="活动规则说明..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>壁纸分类主题</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="如：风景" />
              </div>
              <div>
                <Label>奖品经验值</Label>
                <Input type="number" value={form.prizeExp} onChange={(e) => setForm({ ...form, prizeExp: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>开始时间 *</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <Label>结束时间 *</Label>
                <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>每人最大投稿数</Label>
                <Input type="number" value={form.maxSubmissions} onChange={(e) => setForm({ ...form, maxSubmissions: parseInt(e.target.value) || 3 })} />
              </div>
              <div>
                <Label>每人每天投票数</Label>
                <Input type="number" value={form.votesPerDay} onChange={(e) => setForm({ ...form, votesPerDay: parseInt(e.target.value) || 5 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} 创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑活动对话框 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑挑战赛活动</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>活动标题 *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="如：春日风光壁纸大赛" />
            </div>
            <div>
              <Label>活动描述和规则</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="活动规则说明..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>壁纸分类主题</Label>
                <Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} placeholder="如：风景" />
              </div>
              <div>
                <Label>活动状态</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  <option value="draft">草稿</option>
                  <option value="active">进行中</option>
                  <option value="ended">已结束</option>
                  <option value="settled">已结算</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>奖品经验值</Label>
                <Input type="number" value={editForm.prizeExp} onChange={(e) => setEditForm({ ...editForm, prizeExp: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>奖品说明</Label>
                <Input value={editForm.prizeDescription} onChange={(e) => setEditForm({ ...editForm, prizeDescription: e.target.value })} placeholder="奖品描述" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>开始时间 *</Label>
                <Input type="datetime-local" value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} />
              </div>
              <div>
                <Label>结束时间 *</Label>
                <Input type="datetime-local" value={editForm.endTime} onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>每人最大投稿数</Label>
                <Input type="number" value={editForm.maxSubmissions} onChange={(e) => setEditForm({ ...editForm, maxSubmissions: parseInt(e.target.value) || 3 })} />
              </div>
              <div>
                <Label>每人每天投票数</Label>
                <Input type="number" value={editForm.votesPerDay} onChange={(e) => setEditForm({ ...editForm, votesPerDay: parseInt(e.target.value) || 5 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} 保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}