"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { Eye, EyeOff, Lock, ImageIcon, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <Card className="rounded-2xl border-none shadow-lg">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-[var(--color-mute)]">
            重置链接无效。请重新
            <Link
              href="/forgot-password"
              className="text-[var(--color-primary)] hover:underline"
            >
              申请重置
            </Link>
            。
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("请填写所有字段");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("密码至少 6 个字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        toast.success("密码重置成功");
      } else {
        toast.error(data.error || "重置失败");
      }
    } catch {
      toast.error("重置失败，请稍后重试");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="rounded-2xl border-none shadow-lg">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
          <h2 className="text-xl font-bold">密码重置成功</h2>
          <p className="text-sm text-[var(--color-mute)]">
            您的密码已成功重置，请使用新密码登录。
          </p>
          <Button
            onClick={() => router.push("/login")}
            className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)]"
          >
            去登录
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-none shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-primary)] flex items-center justify-center">
            <ImageIcon className="w-7 h-7 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">重置密码</CardTitle>
        <CardDescription>请输入您的新密码</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                placeholder="至少 6 个字符"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-[var(--radius-md)]"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12 rounded-[var(--radius-md)]"
                required
                minLength={6}
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-[var(--radius-md)] text-base font-bold gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)]"
          >
            {loading ? "重置中..." : "重置密码"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-surface-soft)] px-4">
      <Toaster position="top-right" richColors />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Suspense fallback={<div className="h-64 skeleton-pulse rounded-xl" />}>
          <ResetPasswordForm />
        </Suspense>
      </motion.div>
    </div>
  );
}