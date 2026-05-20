"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  FileText,
  Link2,
  User,
  BadgeCheck,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { withCsrfHeader } from "@/lib/csrf-client";

interface VerificationStatusData {
  verification_status: "none" | "pending" | "approved" | "rejected";
  is_verified: number;
  verified_at: string | null;
  verification_applied_at: string | null;
  verification_rejected_reason: string | null;
}

interface CreatorApplicationFormProps {
  status: VerificationStatusData | null;
  onStatusChange?: () => void;
}

export default function CreatorApplicationForm({
  status,
  onStatusChange,
}: CreatorApplicationFormProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    real_name: "",
    id_type: "id_card",
    id_number: "",
    portfolio_url: "",
    brand_name: "",
    brand_description: "",
  });

  // 已是认证创作者
  if (status?.verification_status === "approved") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-blue-500" />
            认证创作者
          </CardTitle>
          <CardDescription>您已通过创作者认证审核</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>认证时间：{status.verified_at || "未知"}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 待审核
  if (status?.verification_status === "pending") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
            等待审核
          </CardTitle>
          <CardDescription>您的认证申请正在审核中</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>申请时间：{status.verification_applied_at || "未知"}</span>
          </div>
          <Badge variant="secondary" className="mt-2">审核中</Badge>
        </CardContent>
      </Card>
    );
  }

  // 被拒绝 - 显示原因并可重新申请
  const isRejected = status?.verification_status === "rejected";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) {
      toast.error("请先登录");
      return;
    }

    if (!formData.real_name || !formData.id_number) {
      toast.error("请填写真实姓名和身份证明编号");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/creator/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...await withCsrfHeader(),
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        onStatusChange?.();
      } else {
        toast.error(data.error || "提交失败");
      }
    } catch {
      toast.error("提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          申请创作者认证
        </CardTitle>
        <CardDescription>
          成为认证创作者，获取专属标识、品牌主页和更多特权
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isRejected && status?.verification_rejected_reason && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>上次审核未通过：</strong>{status.verification_rejected_reason}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="real_name" className="flex items-center gap-1">
              <User className="w-4 h-4" /> 真实姓名 *
            </Label>
            <Input
              id="real_name"
              value={formData.real_name}
              onChange={(e) => setFormData({ ...formData, real_name: e.target.value })}
              placeholder="请输入您的真实姓名"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_type">身份证明类型 *</Label>
            <Select
              value={formData.id_type}
              onValueChange={(v) => setFormData({ ...formData, id_type: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id_card">身份证</SelectItem>
                <SelectItem value="passport">护照</SelectItem>
                <SelectItem value="driver_license">驾照</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="id_number" className="flex items-center gap-1">
              <FileText className="w-4 h-4" /> 身份证明编号 *
            </Label>
            <Input
              id="id_number"
              value={formData.id_number}
              onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
              placeholder="请输入身份证明编号"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="portfolio_url" className="flex items-center gap-1">
              <Link2 className="w-4 h-4" /> 作品集链接
            </Label>
            <Input
              id="portfolio_url"
              value={formData.portfolio_url}
              onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
              placeholder="https://your-portfolio.com"
              type="url"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_name">品牌名称（可选）</Label>
            <Input
              id="brand_name"
              value={formData.brand_name}
              onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
              placeholder="您的品牌/工作室名称"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_description">品牌简介（可选）</Label>
            <Textarea
              id="brand_description"
              value={formData.brand_description}
              onChange={(e) => setFormData({ ...formData, brand_description: e.target.value })}
              placeholder="简单介绍您的品牌或创作理念"
              maxLength={1000}
              rows={3}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            {isRejected ? "重新提交认证申请" : "提交认证申请"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}