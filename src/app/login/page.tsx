"use client";

import { Suspense, useState, useEffect } from "react";
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
  const [oauthStatus, setOauthStatus] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });

  // 检查 OAuth 可用性
  useEffect(() => {
    fetch("/api/auth/oauth-status")
      .then((res) => res.json())
      .then((data) => setOauthStatus(data))
      .catch(() => {});
  }, []);

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
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              忘记密码？
            </Link>
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

        {/* Social Login */}
        {(oauthStatus.google || oauthStatus.github) && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-hairline)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-[var(--color-mute)]">
                  或使用第三方账号登录
                </span>
              </div>
            </div>
            <div className={`mt-4 grid gap-3 ${oauthStatus.google && oauthStatus.github ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {oauthStatus.google && (
                <button
                  onClick={() => signIn("google", { callbackUrl: "/" })}
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-full border border-[var(--color-hairline)] hover:bg-[var(--color-surface-card)] transition-colors text-sm font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </button>
              )}
              {oauthStatus.github && (
                <button
                  onClick={() => signIn("github", { callbackUrl: "/" })}
                  className="flex items-center justify-center gap-2 h-11 px-4 rounded-full border border-[var(--color-hairline)] hover:bg-[var(--color-surface-card)] transition-colors text-sm font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              )}
            </div>
          </div>
        )}
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