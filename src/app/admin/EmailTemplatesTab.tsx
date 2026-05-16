"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  Variable,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X,
  Tag,
  ToggleLeft,
  ToggleRight,
  FileEdit,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// === 类型定义 ===
interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

interface EmailTemplate {
  id: number;
  template_key: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: TemplateVariable[];
  category: string;
  is_builtin: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

type TemplateCategory = "auth" | "review" | "notification" | "system" | "social";
type EditField = "subject" | "body_html" | "body_text";

export default function EmailTemplatesTab() {
  // === 状态 ===
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [variableGroups, setVariableGroups] = useState<Record<string, TemplateVariable[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState({
    template_key: "",
    name: "",
    description: "",
    subject: "",
    body_html: "",
    body_text: "",
    category: "system" as TemplateCategory,
    is_active: true,
    variables: [] as TemplateVariable[],
  });
  const [saving, setSaving] = useState(false);

  // 全屏编辑模式
  const [fullscreenField, setFullscreenField] = useState<EditField | null>(null);

  // 预览对话框
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // 删除确认
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<EmailTemplate | null>(null);

  // 变量插入
  const [variableTarget, setVariableTarget] = useState<EditField>("body_html");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const bodyHtmlRef = useRef<HTMLTextAreaElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const fullscreenRef = useRef<HTMLTextAreaElement>(null);

  // 默认展开所有变量组
  const ensureGroupsExpanded = useCallback((groups: Record<string, TemplateVariable[]>) => {
    const expanded: Record<string, boolean> = {};
    Object.keys(groups).forEach((g) => { expanded[g] = true; });
    setExpandedGroups(expanded);
  }, []);

  // === 加载模板 ===
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetch(`/api/admin/email-templates?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
        setCategories(data.categories || {});
        setVariableGroups(data.variableGroups || {});
        ensureGroupsExpanded(data.variableGroups || {});
      } else {
        toast.error(data.error || "加载模板失败");
      }
    } catch (err) {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, ensureGroupsExpanded]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // === 过滤模板 ===
  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.template_key.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q)
    );
  });

  // === 打开编辑 ===
  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsNew(false);
    setFormData({
      template_key: template.template_key,
      name: template.name,
      description: template.description || "",
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text || "",
      category: template.category as TemplateCategory,
      is_active: !!template.is_active,
      variables: template.variables || [],
    });
    setEditDialogOpen(true);
    setFullscreenField(null);
  };

  // === 新建模板 ===
  const handleNew = () => {
    setEditingTemplate(null);
    setIsNew(true);
    setFormData({
      template_key: "",
      name: "",
      description: "",
      subject: "",
      body_html: "",
      body_text: "",
      category: "system",
      is_active: true,
      variables: [],
    });
    setEditDialogOpen(true);
    setFullscreenField(null);
  };

  // === 保存模板 ===
  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body_html || !formData.category) {
      toast.error("请填写必填字段：名称、主题、HTML正文、分类");
      return;
    }
    if (isNew && !formData.template_key) {
      toast.error("请填写模板标识");
      return;
    }

    setSaving(true);
    try {
      const url = "/api/admin/email-templates";
      const method = isNew ? "POST" : "PUT";
      const body = isNew
        ? formData
        : { id: editingTemplate!.id, ...formData };

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setEditDialogOpen(false);
        setFullscreenField(null);
        fetchTemplates();
      } else {
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSaving(false);
    }
  };

  // === 删除模板 ===
  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/admin/email-templates?id=${deletingTemplate.id}`, {
        method: "DELETE",
        headers: { ...csrfHeaders },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setDeleteDialogOpen(false);
        setDeletingTemplate(null);
        fetchTemplates();
      } else {
        toast.error(data.error || "删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  // === 预览模板 ===
  const handlePreview = async (template: EmailTemplate) => {
    setPreviewLoading(true);
    setPreviewDialogOpen(true);
    try {
      const exampleData: Record<string, string> = {};
      template.variables?.forEach((v) => {
        exampleData[v.key] = v.example || `{{${v.key}}}`;
      });

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/email-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ template_key: template.template_key, data: exampleData }),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject);
      } else {
        toast.error(data.error || "预览失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setPreviewLoading(false);
    }
  };

  // === 切换模板启用/禁用 ===
  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ id: template.id, is_active: !template.is_active }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(template.is_active ? "模板已禁用" : "模板已启用");
        fetchTemplates();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("网络错误");
    }
  };

  // === 获取当前目标字段的 ref ===
  const getActiveRef = useCallback((): HTMLTextAreaElement | HTMLInputElement | null => {
    if (fullscreenField && fullscreenRef.current) return fullscreenRef.current;
    if (variableTarget === "subject") return subjectRef.current;
    if (variableTarget === "body_html") return bodyHtmlRef.current;
    if (variableTarget === "body_text") return bodyTextRef.current;
    return null;
  }, [fullscreenField, variableTarget]);

  // === 插入变量 ===
  const insertVariable = (varKey: string) => {
    const variable = `{{${varKey}}}`;
    const field = fullscreenField || variableTarget;

    const el = getActiveRef();
    if (el && "selectionStart" in el) {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const value = formData[field];
      const newValue = value.slice(0, start) + variable + value.slice(end);
      setFormData((prev) => ({ ...prev, [field]: newValue }));
      // 恢复光标位置
      setTimeout(() => {
        const pos = start + variable.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setFormData((prev) => ({ ...prev, [field]: prev[field] + variable }));
    }

    setCopiedKey(varKey);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // === 复制变量到剪贴板 ===
  const copyVariable = (varKey: string) => {
    navigator.clipboard.writeText(`{{${varKey}}}`);
    setCopiedKey(varKey);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // === 切换变量分组展开 ===
  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // === 分类颜色映射 ===
  const categoryColors: Record<string, string> = {
    auth: "bg-blue-100 text-blue-700",
    review: "bg-amber-100 text-amber-700",
    notification: "bg-green-100 text-green-700",
    system: "bg-gray-100 text-gray-700",
    social: "bg-purple-100 text-purple-700",
  };

  // === 变量面板组件（复用） ===
  const VariablePanel = () => (
    <div className="space-y-1">
      {Object.entries(variableGroups).map(([groupName, vars]) => (
        <div key={groupName}>
          <button
            className="flex items-center gap-1.5 w-full text-left text-xs font-medium text-muted-foreground hover:text-foreground py-1.5 px-1 rounded hover:bg-muted/50"
            onClick={() => toggleGroup(groupName)}
          >
            {expandedGroups[groupName] ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            {groupName}
            <span className="ml-auto text-[10px] bg-muted rounded-full px-1.5">{vars.length}</span>
          </button>

          <AnimatePresence>
            {expandedGroups[groupName] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5 pl-5 pb-1.5">
                  {vars.map((v) => (
                    <div
                      key={v.key}
                      className="flex items-center gap-1 group py-1 px-1.5 rounded hover:bg-blue-50 cursor-pointer"
                    >
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => insertVariable(v.key)}
                        title={`${v.label}：${v.example}（点击插入）`}
                      >
                        <span className="text-xs font-mono text-blue-600 whitespace-nowrap">
                          {`{{${v.key}}}`}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2 truncate">
                          {v.label}
                        </span>
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyVariable(v.key);
                        }}
                        title="复制变量"
                      >
                        {copiedKey === v.key ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* 标题和操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold">邮件模板管理</h2>
          <Badge variant="secondary">{templates.length} 个模板</Badge>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          新建模板
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索模板名称、标识..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {Object.entries(categories).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 模板列表 */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery || categoryFilter !== "all" ? "没有匹配的模板" : "暂无模板，点击右上角新建"}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={`p-4 hover:shadow-md transition-shadow ${!template.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-base truncate">{template.name}</h3>
                      <Badge className={categoryColors[template.category] || "bg-gray-100 text-gray-700"}>
                        {categories[template.category] || template.category}
                      </Badge>
                      {template.is_builtin ? (
                        <Badge variant="outline" className="text-xs">内置</Badge>
                      ) : null}
                      {!template.is_active ? (
                        <Badge variant="secondary" className="text-xs text-red-500">已禁用</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{template.template_key}</code>
                      {template.description && ` — ${template.description}`}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {template.variables?.slice(0, 5).map((v) => (
                        <span
                          key={v.key}
                          className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-100"
                          title={`${v.label}: ${v.example}`}
                        >
                          {`{{${v.key}}}`}
                        </span>
                      ))}
                      {template.variables?.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{template.variables.length - 5} 个变量
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(template)}
                      title={template.is_active ? "禁用模板" : "启用模板"}
                    >
                      {template.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(template)}
                      title="预览"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {!template.is_builtin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingTemplate(template);
                          setDeleteDialogOpen(true);
                        }}
                        title="删除"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ====== 编辑/新建对话框 ====== */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) setFullscreenField(null); setEditDialogOpen(open); }}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="w-5 h-5" />
              {isNew ? "新建邮件模板" : `编辑模板: ${editingTemplate?.name}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6 space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              {isNew && (
                <div>
                  <Label>模板标识 *</Label>
                  <Input
                    placeholder="如: welcome, password_reset"
                    value={formData.template_key}
                    onChange={(e) => setFormData((prev) => ({ ...prev, template_key: e.target.value.replace(/\s/g, "_") }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">唯一标识，创建后不可修改</p>
                </div>
              )}
              <div>
                <Label>模板名称 *</Label>
                <Input
                  placeholder="如: 欢迎注册邮件"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>分类 *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, category: v as TemplateCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>描述</Label>
              <Input
                placeholder="模板用途说明"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* 邮件主题 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>邮件主题 *</Label>
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={() => { setVariableTarget("subject"); setFullscreenField("subject"); }}>
                  <Maximize2 className="w-3 h-3" /> 放大
                </Button>
              </div>
              <Input
                ref={subjectRef}
                placeholder="如: 欢迎加入壁纸社区，{{user_name}}！"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
              />
            </div>

            {/* HTML 正文 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>HTML 正文 *</Label>
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={() => { setVariableTarget("body_html"); setFullscreenField("body_html"); }}>
                  <Maximize2 className="w-3 h-3" /> 放大
                </Button>
              </div>
              <Textarea
                ref={bodyHtmlRef}
                placeholder="HTML 邮件正文，使用 {{variable}} 插入动态变量"
                value={formData.body_html}
                onChange={(e) => setFormData((prev) => ({ ...prev, body_html: e.target.value }))}
                className="min-h-[200px] font-mono text-sm"
              />
            </div>

            {/* 纯文本正文 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>纯文本正文</Label>
                <Button variant="ghost" size="sm" className="text-xs h-6 gap-1" onClick={() => { setVariableTarget("body_text"); setFullscreenField("body_text"); }}>
                  <Maximize2 className="w-3 h-3" /> 放大
                </Button>
              </div>
              <Textarea
                ref={bodyTextRef}
                placeholder="纯文本版本（可选），使用 {{variable}} 插入动态变量"
                value={formData.body_text}
                onChange={(e) => setFormData((prev) => ({ ...prev, body_text: e.target.value }))}
                className="min-h-[80px] font-mono text-sm"
              />
            </div>

            {/* 启用开关 */}
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
              />
              <Label>启用此模板</Label>
            </div>

            {/* ====== 穿梭式变量选择器 ====== */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-3 mb-3">
                <Variable className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-sm">变量快捷插入</span>
                <span className="text-xs text-muted-foreground">点击变量标签插入到目标字段</span>
                <div className="ml-auto">
                  <Select value={variableTarget} onValueChange={(v) => setVariableTarget(v as EditField)}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subject">邮件主题</SelectItem>
                      <SelectItem value="body_html">HTML正文</SelectItem>
                      <SelectItem value="body_text">纯文本正文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 按分组横向排列变量标签 */}
              <div className="space-y-2">
                {Object.entries(variableGroups).map(([groupName, vars]) => (
                  <div key={groupName} className="flex items-start gap-2">
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap pt-0.5 w-16 shrink-0 text-right">
                      {groupName}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {vars.map((v) => (
                        <button
                          key={v.key}
                          className="inline-flex items-center gap-1 text-xs bg-background border rounded px-1.5 py-0.5 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                          onClick={() => insertVariable(v.key)}
                          title={`${v.label}：${v.example}`}
                        >
                          <code className="text-blue-600 font-mono">{`{{${v.key}}}`}</code>
                          <span className="text-muted-foreground">{v.label}</span>
                          {copiedKey === v.key && <Check className="w-3 h-3 text-green-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* 当前模板关联变量 */}
              {formData.variables.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs font-medium text-muted-foreground mr-2">模板变量:</span>
                  <div className="inline-flex flex-wrap gap-1">
                    {formData.variables.map((v) => (
                      <Badge key={v.key} variant="outline" className="text-xs cursor-pointer hover:bg-blue-50"
                        onClick={() => insertVariable(v.key)}
                      >
                        {v.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setFullscreenField(null); }}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== 全屏编辑对话框 ====== */}
      <Dialog open={!!fullscreenField} onOpenChange={(open) => { if (!open) setFullscreenField(null); }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Maximize2 className="w-5 h-5" />
                {fullscreenField === "subject" ? "编辑邮件主题" : fullscreenField === "body_html" ? "编辑 HTML 正文" : "编辑纯文本正文"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={variableTarget}
                  onValueChange={(v) => setVariableTarget(v as EditField)}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subject">邮件主题</SelectItem>
                    <SelectItem value="body_html">HTML正文</SelectItem>
                    <SelectItem value="body_text">纯文本正文</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFullscreenField(null)}
                  className="gap-1"
                >
                  <Minimize2 className="w-3 h-3" />
                  退出全屏
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* 编辑区 */}
            <div className="flex-1 flex flex-col min-w-0">
              {fullscreenField === "subject" ? (
                <Input
                  ref={fullscreenRef as any}
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="邮件主题"
                  className="font-mono text-base h-12"
                  autoFocus
                />
              ) : (
                <Textarea
                  ref={fullscreenRef}
                  value={formData[fullscreenField!]}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [fullscreenField!]: e.target.value }))}
                  placeholder={fullscreenField === "body_html" ? "HTML 邮件正文" : "纯文本正文"}
                  className="flex-1 font-mono text-sm min-h-[500px] resize-none"
                  autoFocus
                />
              )}
            </div>

            {/* 右侧变量面板 */}
            <div className="w-56 shrink-0 border-l pl-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                <Variable className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">插入变量</span>
              </div>
              <VariablePanel />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== 预览对话框 ====== */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              邮件预览
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">主题</Label>
              <p className="font-medium">{previewSubject}</p>
            </div>
            <div className="border rounded-lg overflow-hidden">
              {previewLoading ? (
                <div className="p-8 text-center text-muted-foreground">加载预览...</div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full min-h-[500px] bg-white"
                  sandbox="allow-same-origin"
                  title="邮件预览"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== 删除确认对话框 ====== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p>
            确定要删除模板「<strong>{deletingTemplate?.name}</strong>」吗？此操作不可恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}