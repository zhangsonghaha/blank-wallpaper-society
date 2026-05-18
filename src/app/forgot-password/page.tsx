"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { Mail, ArrowLeft, ImageIcon, Send } from "lucide-react";
import "altcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AltchaWidget from "@/components/AltchaWidget";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [altchaVerified, setAltchaVerified] = useState(false);
  const [altchaPayload, setAltchaPayload] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("请输入邮箱");
      return;
    }

    if (!altchaVerified) {
      toast.error("请完成人机验证");
      return;
    }

    if (!altchaPayload) {
      toast.error("验证码数据获取失败，请重试");
      return;
    }

    setLoading(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ email, altchaPayload }),
      });
      const data = await res.json();

      if (res.ok) {
        setSent(true);
        toast.success("重置链接已发送");
      } else {
        toast.error(data.error || "请求失败");
      }
    } catch {
      toast.error("请求失败，请稍后重试");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-surface-soft)] px-4">
      <Toaster position="top-right" richColors />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-2xl border-none shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-primary)] flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">忘记密码</CardTitle>
            <CardDescription>
              {sent
                ? "重置链接已发送到您的邮箱"
                : "输入您的邮箱地址，我们将发送密码重置链接"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-xl text-center">
                  <Mail className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm text-emerald-700 font-medium">
                    重置链接已发送
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    请检查 {email} 的收件箱（含垃圾邮件）
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                    setAltchaVerified(false);
                    setAltchaPayload(null);
                  }}
                  variant="outline"
                  className="w-full rounded-xl"
                >
                  重新发送
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱地址</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 rounded-[var(--radius-md)]"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                {/* Altcha 人机验证 */}
                <AltchaWidget
                  onVerifiedChange={setAltchaVerified}
                  onPayloadChange={setAltchaPayload}
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-[var(--radius-md)]"
                >
                  {loading ? (
                    <>
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      发送中...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      发送重置链接
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                返回登录
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}