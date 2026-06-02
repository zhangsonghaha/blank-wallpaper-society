"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";
import { gsap } from "gsap";
import "altcha";
import AltchaWidget from "@/components/AltchaWidget";
import { withCsrfHeader } from "@/lib/csrf-client";

/* ============ 壁纸图片（动态从 API 获取） ============ */

/* ============ 样式 ============ */
const styles = `
.auth-ambient {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(60% 50% at 20% 30%, rgba(168, 85, 247, 0.06), transparent 60%),
    radial-gradient(50% 40% at 80% 70%, rgba(236, 72, 153, 0.05), transparent 60%),
    radial-gradient(40% 30% at 60% 20%, rgba(59, 130, 246, 0.04), transparent 60%);
}
.auth-wall-stage {
  position: fixed; inset: 0; z-index: 200;
  background: #ffffff;
  display: flex; align-items: center; justify-content: center;
  perspective: 1200px;
}
.auth-wall-grid {
  display: grid;
  grid-template-columns: repeat(6, 130px);
  grid-template-rows: repeat(4, 130px);
  gap: 8px;
  transform: rotateX(8deg) rotateY(-5deg) scale(0.9);
}
.auth-wall-cell {
  background-size: cover; background-position: center;
  background-color: #f4f4f5;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  will-change: transform, opacity;
  opacity: 0;
}
.auth-intro-logo {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 210; pointer-events: none;
  text-align: center;
  opacity: 0;
}
.auth-intro-logo .mark {
  width: 56px; height: 56px; border-radius: 14px;
  background: #0a0a0a;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; font-size: 28px; font-weight: 800;
  margin-bottom: 18px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}
.auth-intro-logo .name {
  font-size: 14px; letter-spacing: 6px;
  color: #18181b; font-weight: 600;
}
.auth-app { opacity: 0; min-height: calc(100vh - 64px - 60px); display: flex; flex-direction: column; }
.auth-stage {
  display: flex; align-items: center; justify-content: center;
  flex: 1;
  padding: 32px 16px;
}
.auth-card {
  width: 100%; max-width: 420px;
  background: #fff;
  border: 1px solid #f4f4f5;
  border-radius: 20px;
  box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.08);
  padding: 36px 32px 28px;
  position: relative;
}
.auth-card-head { text-align: center; margin-bottom: 28px; }
.auth-card-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: #0a0a0a;
  display: inline-flex; align-items: center; justify-content: center;
  color: #fff; margin-bottom: 18px;
}
.auth-card-icon svg { width: 22px; height: 22px; }
.auth-card-head h1 {
  font-size: 22px; font-weight: 700;
  color: #18181b; letter-spacing: -0.4px;
  margin-bottom: 6px;
}
.auth-card-head p {
  font-size: 13px; color: #71717a;
}
.auth-form { display: flex; flex-direction: column; gap: 14px; }
.auth-field { position: relative; }
.auth-field input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  background: #fafafa;
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 14px; color: #18181b;
  outline: none;
  transition: all 0.25s ease;
}
.auth-field input::placeholder { color: #a1a1aa; }
.auth-field input:hover { background: #f4f4f5; }
.auth-field input:focus {
  background: #fff;
  border-color: #0a0a0a;
  box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.08);
}
.auth-field .ico {
  position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
  color: #a1a1aa; pointer-events: none;
  transition: color 0.25s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.auth-field .ico svg { width: 16px; height: 16px; display: block; }
.auth-field input:focus ~ .ico { color: #0a0a0a; transform: translateY(-50%) scale(1.1); }
.auth-field .toggle-pwd {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  color: #a1a1aa; padding: 4px; background: none; border: none; cursor: pointer;
  transition: color 0.2s;
}
.auth-field .toggle-pwd:hover { color: #52525b; }
.auth-field .toggle-pwd svg { width: 16px; height: 16px; display: block; }
.auth-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12.5px; color: #71717a;
  margin-top: 2px;
}
.auth-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.auth-check input { display: none; }
.auth-check .box {
  width: 16px; height: 16px; border-radius: 4px;
  border: 1.5px solid #d4d4d8;
  background: #fff;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.auth-check input:checked + .box { background: #0a0a0a; border-color: #0a0a0a; }
.auth-check input:checked + .box::after { content: "✓"; color: #fff; font-size: 11px; font-weight: 700; }
.auth-check:hover .box { border-color: #71717a; }
.auth-row a { color: #71717a; text-decoration: none; }
.auth-row a:hover { color: #18181b; }
.auth-btn {
  margin-top: 6px;
  width: 100%; padding: 13px 16px;
  background: #0a0a0a; color: #fff;
  border-radius: 12px;
  font-size: 14px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  position: relative; overflow: hidden;
  border: none; cursor: pointer;
  transition: all 0.25s ease;
}
.auth-btn:hover { background: #27272a; transform: translateY(-1px); box-shadow: 0 8px 20px -4px rgba(0,0,0,0.25); }
.auth-btn:active { transform: translateY(0); }
.auth-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }
.auth-btn svg { width: 14px; height: 14px; transition: transform 0.3s; }
.auth-btn:hover svg:not(:disabled) { transform: translateX(3px); }
.auth-btn::after {
  content: ""; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.6s;
}
.auth-btn:hover::after:not(:disabled) { left: 100%; }
.auth-test-card {
  margin-top: 18px;
  padding: 12px 14px;
  background: #fafafa;
  border-radius: 10px;
  font-size: 12px;
  color: #71717a;
  line-height: 1.7;
}
.auth-test-card .title {
  font-size: 11px; font-weight: 600; color: #52525b;
  letter-spacing: 0.5px; margin-bottom: 4px;
}
.auth-test-card .row-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.auth-test-card code {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 11.5px; color: #18181b;
  background: #fff;
  padding: 1px 5px; border-radius: 4px;
}
.auth-divider {
  display: flex; align-items: center; gap: 12px;
  margin: 22px 0 14px;
  color: #a1a1aa; font-size: 11.5px;
}
.auth-divider::before, .auth-divider::after { content: ""; flex: 1; height: 1px; background: #f4f4f5; }
.auth-socials { display: flex; flex-direction: column; gap: 10px; }
.auth-social-btn {
  width: 100%; padding: 11px 16px;
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 12px;
  font-size: 13.5px; font-weight: 500;
  color: #18181b;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.auth-social-btn:hover { background: #fafafa; border-color: #d4d4d8; transform: translateY(-1px); box-shadow: 0 4px 12px -4px rgba(0,0,0,0.08); }
.auth-social-btn svg { width: 16px; height: 16px; }
.auth-social-btn.github { background: #0a0a0a; color: #fff; border-color: #0a0a0a; }
.auth-social-btn.github:hover { background: #27272a; }
.auth-foot {
  margin-top: 22px; padding-top: 18px;
  border-top: 1px solid #f4f4f5;
  text-align: center;
  font-size: 12.5px; color: #71717a;
}
.auth-foot a { color: #18181b; font-weight: 600; text-decoration: none; cursor: pointer; }
.auth-bottom-meta {
  position: fixed; bottom: 20px; left: 0; right: 0;
  text-align: center; z-index: 6;
  font-size: 11px; color: #a1a1aa; letter-spacing: 2px;
  pointer-events: none;
}
.auth-altcha-wrap { margin: 4px 0; }

@media (max-width: 720px) {
  .auth-card { border-radius: 16px; padding: 28px 22px 22px; }
}
@media (max-width: 768px) {
  .auth-wall-grid {
    grid-template-columns: repeat(4, 90px);
    grid-template-rows: repeat(6, 90px);
    gap: 6px;
  }
}
`;

/* ============ SVG 图标 ============ */
const EmailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);
const EyeOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);
const SpinnerIcon = () => (
  <svg className="auth-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'auth-spin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
  </svg>
);

/* ============ 表单组件 ============ */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const modeParam = searchParams.get("mode");

  const [mode, setMode] = useState<"login" | "signup">(modeParam === "register" ? "signup" : "login");
  const [loading, setLoading] = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);
  const [oauthAvailable, setOauthAvailable] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  const [sessionReady, setSessionReady] = useState(false);
  const [wallpapers, setWallpapers] = useState<string[]>([]);
  const [wallpapersLoaded, setWallpapersLoaded] = useState(false);

  // 已登录检测 — 已登录用户直接跳转首页
  const { status: sessionStatus } = useSession();
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      router.replace("/");
    } else if (sessionStatus === "unauthenticated") {
      setSessionReady(true);
    }
  }, [sessionStatus, router]);

  // 注册字段
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@img.com");
  const [password, setPassword] = useState("admin123");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(false);

  // Altcha
  const [altchaVerified, setAltchaVerified] = useState(false);
  const [altchaPayload, setAltchaPayload] = useState<string | null>(null);

  // Refs
  const wallStageRef = useRef<HTMLDivElement>(null);
  const wallGridRef = useRef<HTMLDivElement>(null);
  const introLogoRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animDoneRef = useRef(false);

  // 检查 OAuth 可用性
  useEffect(() => {
    fetch("/api/auth/oauth-status")
      .then((r) => r.json())
      .then((d) => setOauthAvailable(d))
      .catch(() => {});
  }, []);

  // 加载随机壁纸
  useEffect(() => {
    fetch("/api/auth/login-wallpapers")
      .then((r) => r.json())
      .then((data) => {
        if (data?.images?.length) setWallpapers(data.images);
        setWallpapersLoaded(true);
      })
      .catch(() => setWallpapersLoaded(true));
  }, []);

  // GSAP 开场动画 — 只在确认未登录 + 壁纸加载后播放
  useEffect(() => {
    if (!sessionReady) return;
    if (!wallpapersLoaded) return;
    if (animDoneRef.current) return;
    animDoneRef.current = true;

    const cells = cellsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cells.length === 0) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 0: logo 浮现
    tl.to(".auth-intro-logo", { duration: 0.6, opacity: 1, y: -10, ease: "power2.out" }, 0);
    // 0.6: logo 退场
    tl.to(".auth-intro-logo", { duration: 0.4, opacity: 0, scale: 0.85, ease: "power2.in" }, 0.8);

    // 0.8: 壁纸阵列飞入
    cells.forEach((cell, i) => {
      const fromX = (Math.random() - 0.5) * 1600;
      const fromY = (Math.random() - 0.5) * 1000;
      const fromRot = (Math.random() - 0.5) * 90;
      const delay = 0.8 + Math.random() * 0.5;
      tl.fromTo(cell,
        { x: fromX, y: fromY, rotation: fromRot, opacity: 0, scale: 0.5 },
        { duration: 0.9, x: 0, y: 0, rotation: 0, opacity: 1, scale: 1, ease: "expo.out" },
        delay
      );
    });

    // 阵列停留
    tl.to({}, { duration: 0.6 });

    // 2.5: 阵列散开
    cells.forEach((cell) => {
      const toX = (Math.random() - 0.5) * 1800;
      const toY = (Math.random() - 0.5) * 1100;
      const toRot = (Math.random() - 0.5) * 120;
      tl.to(cell, {
        duration: 0.7,
        x: toX, y: toY, rotation: toRot,
        opacity: 0, scale: 0.5,
        ease: "power2.in"
      }, 2.5);
    });

    // 3.0: 加载背景淡出
    tl.to(".auth-wall-stage", {
      duration: 0.5, opacity: 0, ease: "power2.inOut",
      onComplete: () => {
        const el = wallStageRef.current;
        if (el) { el.style.display = "none"; }
        const logo = introLogoRef.current;
        if (logo) { logo.style.display = "none"; }
      }
    }, 3.0);

    // 3.0: 主页显示
    tl.set(".auth-app", { opacity: 1 }, 3.0);
    tl.from(".auth-card", { duration: 0.9, y: 30, opacity: 0, scale: 0.96, ease: "power3.out" }, 3.2);
    tl.from(".auth-card-head > *", { duration: 0.5, y: 15, opacity: 0, stagger: 0.08, ease: "power2.out" }, 3.5);
    tl.from(".auth-form-elem", { duration: 0.5, y: 12, opacity: 0, stagger: 0.06, ease: "power2.out" }, 3.6);
    tl.from(".auth-row", { duration: 0.4, opacity: 0, ease: "power2.out" }, 3.8);
    tl.from(".auth-test-card", { duration: 0.5, y: 10, opacity: 0, ease: "power2.out" }, 3.9);
    tl.from(".auth-divider, .auth-social-btn", { duration: 0.4, y: 8, opacity: 0, stagger: 0.05, ease: "power2.out" }, 4.0);
    tl.from(".auth-foot", { duration: 0.4, opacity: 0, ease: "power2.out" }, 4.2);

    return () => { tl.kill(); };
  }, [sessionReady, wallpapersLoaded]);

  // 鼠标视差
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      if (rect.width === 0) return;
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -2;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      gsap.to(card, { duration: 0.6, rotateX: rx, rotateY: ry, ease: "power2.out" });
    };
    const onLeave = () => {
      gsap.to(cardRef.current, { duration: 0.8, rotateX: 0, rotateY: 0, ease: "power2.out" });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // 模式切换动画
  const switchMode = useCallback((m: "login" | "signup") => {
    if (m === mode) return;
    setMode(m);
    setPwdVisible(false);
    setAltchaVerified(false);
    setAltchaPayload(null);
    setConfirmPassword("");
    const card = cardRef.current;
    if (card) {
      gsap.fromTo(card, { scale: 0.985 }, { duration: 0.35, scale: 1, ease: "power2.out" });
    }
  }, [mode]);

  // 提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("请填写邮箱和密码");
      return;
    }

    if (mode === "signup") {
      if (!name) { toast.error("请填写昵称"); return; }
      if (password.length < 6) { toast.error("密码至少 6 位"); return; }
      if (password !== confirmPassword) { toast.error("两次密码不一致"); return; }
      if (!altchaVerified) { toast.error("请完成人机验证"); return; }
      if (!altchaPayload) { toast.error("验证码数据获取失败，请重试"); return; }
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        // === 注册流程 ===
        const csrfHeaders = await withCsrfHeader();
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders },
          body: JSON.stringify({ name, email, password, altchaPayload }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast.error("注册失败", { description: data.error || "请稍后重试" });
          setLoading(false);
          return;
        }

        toast.success("注册成功！正在自动登录...");

        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.ok) {
          router.push("/");
          router.refresh();
        }
      } else {
        // === 登录流程 ===
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          if (result.error.includes("临时锁定") || result.error.includes("锁定")) {
            toast.error("账号已锁定", { description: result.error, duration: 10000 });
          } else {
            toast.error("登录失败", { description: "邮箱或密码错误" });
          }
        } else {
          toast.success("登录成功");
          if (callbackUrl.startsWith("/admin")) {
            router.push(callbackUrl);
          } else {
            router.push("/");
          }
          router.refresh();
        }
      }
    } catch (err) {
      toast.error(mode === "login" ? "登录失败" : "注册失败", {
        description: "网络错误，请稍后重试",
      });
    }

    setLoading(false);
  };

  const isLogin = mode === "login";

  // session 确认中 — 显示空白加载态，避免已登录用户看动画闪烁
  if (!sessionReady) {
    return (
      <div style={{
        width: "100vw", height: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
        background: "#fff", color: "#a1a1aa", fontSize: 14
      }}>
        <svg className="auth-spinner" style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
        </svg>
        验证登录状态...
      </div>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <style>{`.auth-spinner { animation: auth-spin 0.8s linear infinite; } @keyframes auth-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* 环境光 */}
      <div className="auth-ambient" />

      {/* 加载阶段：壁纸阵列 */}
      <div className="auth-wall-stage" ref={wallStageRef}>
        <div className="auth-wall-grid" ref={wallGridRef}>
          {wallpapers.map((url, i) => (
            <div
              key={i}
              ref={(el) => { cellsRef.current[i] = el; }}
              className="auth-wall-cell"
              style={{ backgroundImage: `url(${url})` }}
            />
          ))}
        </div>
      </div>

      {/* 启动 logo */}
      <div className="auth-intro-logo" ref={introLogoRef}>
        <div className="mark">f</div>
        <div className="name">留白壁纸社</div>
      </div>

      {/* 主页 */}
      <div className="auth-app" ref={appRef}>
        {/* 卡片 */}
        <div className="auth-stage">
          <div className="auth-card" ref={cardRef}>
            <div className="auth-card-head">
              <div className="auth-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <h1>{isLogin ? "欢迎回来" : "创建账号"}</h1>
              <p>{isLogin ? "登录你的账号以继续" : "几秒钟即可加入我们"}</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {/* 昵称（注册模式） */}
              {!isLogin && (
                <div className="auth-field auth-form-elem">
                  <input
                    type="text"
                    placeholder="你的昵称"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                  <span className="ico"><UserIcon /></span>
                </div>
              )}

              {/* 邮箱 */}
              <div className="auth-field auth-form-elem">
                <input
                  type="email"
                  id="loginEmail"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <span className="ico"><EmailIcon /></span>
              </div>

              {/* 密码 */}
              <div className="auth-field auth-form-elem">
                <input
                  type={pwdVisible ? "text" : "password"}
                  id="loginPassword"
                  placeholder={isLogin ? "输入密码" : "至少 6 位"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  minLength={6}
                />
                <span className="ico"><LockIcon /></span>
                <button
                  type="button"
                  className="toggle-pwd"
                  onClick={() => setPwdVisible(!pwdVisible)}
                  tabIndex={-1}
                >
                  {pwdVisible ? <EyeOnIcon /> : <EyeOffIcon />}
                </button>
              </div>

              {/* 确认密码（注册模式） */}
              {!isLogin && (
                <div className="auth-field auth-form-elem">
                  <input
                    type={pwdVisible ? "text" : "password"}
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <span className="ico"><LockIcon /></span>
                </div>
              )}

              {/* 记住我 & 忘记密码（登录模式） */}
              {isLogin && (
                <div className="auth-row">
                  <label className="auth-check">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    <span className="box" />
                    <span>记住我</span>
                  </label>
                  <a href="/forgot-password">忘记密码？</a>
                </div>
              )}

              {/* Altcha（注册模式） */}
              {!isLogin && (
                <div className="auth-altcha-wrap auth-form-elem">
                  <AltchaWidget
                    onVerifiedChange={setAltchaVerified}
                    onPayloadChange={setAltchaPayload}
                  />
                </div>
              )}

              {/* 提交按钮 */}
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? (
                  <><SpinnerIcon />{isLogin ? "登录中..." : "注册中..."}</>
                ) : (
                  <>{isLogin ? "登录" : "注册"}<ArrowIcon /></>
                )}
              </button>
            </form>

            {/* 测试账号（登录模式） */}
            {isLogin && (
              <div className="auth-test-card">
                <div className="title">测试账号</div>
                <div className="row-info">管理员：<code>admin@img.com</code> / <code>admin123</code></div>
                <div className="row-info">普通用户：注册即可</div>
              </div>
            )}

            {/* 第三方登录 */}
            {(oauthAvailable.google || oauthAvailable.github) && (
              <>
                <div className="auth-divider">或使用第三方账号登录</div>
                <div className="auth-socials">
                  {oauthAvailable.github && (
                    <button
                      type="button"
                      className="auth-social-btn github"
                      onClick={() => signIn("github", { callbackUrl: "/" })}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.16c-3.34.73-4.04-1.41-4.04-1.41-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.69.83.57A12 12 0 0 0 12 .3"/></svg>
                      使用 GitHub 登录
                    </button>
                  )}
                  {oauthAvailable.google && (
                    <button
                      type="button"
                      className="auth-social-btn"
                      onClick={() => signIn("google", { callbackUrl: "/" })}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      使用 Google 登录
                    </button>
                  )}
                </div>
              </>
            )}

            {/* 底部切换 */}
            <div className="auth-foot">
              {isLogin ? (
                <>还没有账号？ <a onClick={(e) => { e.preventDefault(); switchMode("signup"); }}>立即注册</a></>
              ) : (
                <>已有账号？ <a onClick={(e) => { e.preventDefault(); switchMode("login"); }}>返回登录</a></>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

/* ============ 页面导出（包 Suspense） ============ */
export default function LoginPage() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Suspense fallback={
        <div style={{
          width: "100%", height: "100vh", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "#fff", color: "#a1a1aa", fontSize: 14
        }}>
          加载中...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </>
  );
}
