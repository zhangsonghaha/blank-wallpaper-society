"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { Eye, EyeOff, LogIn, Mail, Lock, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("请填写邮箱和密码");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("登录失败", {
          description: "邮箱或密码错误",
        });
      } else {
        toast.success("登录成功");
        if (callbackUrl.startsWith("/admin")) {
          router.push(callbackUrl);
        } else {
          router.push("/");
        }
        router.refresh();
      }
    } catch (err) {
      toast.error("登录失败", { description: "网络错误，请稍后重试" });
    }
    setLoading(false);
  };

  return (
    <Card className="rounded-2xl border-none shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-primary)] flex items-center justify-center">
            <ImageIcon className="w-7 h-7 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
        <CardDescription>登录你的账号以继续</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
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
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-mute)]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-[var(--radius-md)]"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-[var(--radius-md)] text-base font-bold gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)]"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                登录中...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                登录
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-card)] text-xs text-[var(--color-mute)]">
          <p className="font-medium mb-1">测试账号</p>
          <p>管理员：admin@img.com / admin123</p>
          <p>普通用户：注册即可</p>
        </div>
      </CardContent>
      <CardFooter className="justify-center pt-0">
        <p className="text-sm text-[var(--color-mute)]">
          还没有账号？{" "}
          <Link
            href="/register"
            className="text-[var(--color-primary)] font-semibold hover:underline"
          >
            立即注册
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-[var(--color-surface-soft)]">
      <Toaster position="top-right" richColors />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Suspense
          fallback={
            <Card className="rounded-2xl border-none shadow-lg">
              <CardContent className="p-8 text-center text-[var(--color-mute)]">
                加载中...
              </CardContent>
            </Card>
          }
        >
          <LoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}