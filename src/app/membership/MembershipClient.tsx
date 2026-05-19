"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Crown,
  Download,
  Sparkles,
  HardDrive,
  Heart,
  Upload,
  Shield,
  Clock,
  Infinity,
  Zap,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";

// 会员价格配置（与 src/lib/earnings.ts 保持同步）
const MEMBERSHIP_PRICES = {
  monthly: 19.9,
  yearly: 149,
  enterprise_monthly: 99,
  enterprise_yearly: 950,
};

interface UsageData {
  tier: string;
  plan: string;
  downloads: { usedToday: number; dailyLimit: number; remaining: number };
  aiGenerate: { usedToday: number; dailyLimit: number; remaining: number };
  storage: { usedMB: number; limitMB: number; usagePercent: number };
  favorites: number;
  uploads: number;
  membership: { isActive: boolean; expiresAt: string | null; daysRemaining: number | null };
}

function getPlanLabel(plan: string) {
  switch (plan) {
    case "monthly": return "Pro 月付";
    case "yearly": return "Pro 年付";
    case "enterprise_monthly": return "企业版月付";
    case "enterprise_yearly": return "企业版年付";
    case "admin": return "管理员";
    default: return plan;
  }
}

function getTierName(tier: string) {
  switch (tier) {
    case "admin": return "管理员";
    case "enterprise": return "企业版";
    case "pro": return "Pro";
    default: return "免费版";
  }
}

export default function MembershipClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly" | "enterprise_monthly" | "enterprise_yearly">("monthly");
  const [selectedAmount, setSelectedAmount] = useState(MEMBERSHIP_PRICES.monthly);

  const membership = (session?.user as any)?.membership as {
    plan: string;
    startedAt: string;
    expiresAt: string;
    status: string;
  } | null;
  const isAdmin = (session?.user as any)?.role === "admin";
  const isMember = !!membership && membership.status === "active";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/user/usage")
      .then((res) => res.json())
      .then((data) => {
        setUsage(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-mute)]">加载中...</div>
      </div>
    );
  }

  // 未登录或非会员/管理员，跳转到定价页
  if (!isMember && !isAdmin) {
    router.push("/pricing");
    return null;
  }

  const tierName = usage ? getTierName(usage.tier) : isAdmin ? "管理员" : "Pro";
  const isEnterprise = membership?.plan?.includes("enterprise") || isAdmin;

  const expiresDate = membership?.expiresAt
    ? new Date(membership.expiresAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)]">
      {/* 顶部会员状态卡片 */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white">
        <div className="max-w-[900px] mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row items-center gap-6"
          >
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
              {isAdmin ? (
                <Shield className="w-10 h-10" />
              ) : (
                <Crown className="w-10 h-10" />
              )}
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-1">
                {tierName} 会员
              </h1>
              <p className="text-white/80 text-sm">
                {membership ? `正在享受 ${getPlanLabel(membership.plan)} 专属权益` : "您拥有最高权限，全功能开放"}
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                <Badge className="bg-white/20 text-white border-white/30 text-xs px-3 py-0.5">
                  <Crown className="w-3 h-3 mr-1" />
                  {membership ? getPlanLabel(membership.plan) : "管理员"}
                </Badge>
                {expiresDate && (
                  <Badge className="bg-white/20 text-white border-white/30 text-xs px-3 py-0.5">
                    <Clock className="w-3 h-3 mr-1" />
                    {usage?.membership.daysRemaining !== null && usage?.membership.daysRemaining !== undefined
                      ? `${usage.membership.daysRemaining} 天后到期`
                      : expiresDate}
                  </Badge>
                )}
                {isAdmin && !membership && (
                  <Badge className="bg-white/20 text-white border-white/30 text-xs px-3 py-0.5">
                    <Shield className="w-3 h-3 mr-1" />
                    永久有效
                  </Badge>
                )}
              </div>
            </div>
            {membership && !isAdmin && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setSelectedPlan("yearly");
                    setSelectedAmount(MEMBERSHIP_PRICES.yearly);
                    setPaymentOpen(true);
                  }}
                  className="bg-white text-amber-700 hover:bg-white/90 rounded-full font-bold shadow-lg gap-1.5"
                >
                  <Crown className="w-4 h-4" />
                  续费 Pro
                </Button>
                {!isEnterprise && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPlan("enterprise_monthly");
                      setSelectedAmount(MEMBERSHIP_PRICES.enterprise_monthly);
                      setPaymentOpen(true);
                    }}
                    className="bg-transparent border-white/40 text-white hover:bg-white/10 rounded-full gap-1.5"
                  >
                    <Zap className="w-4 h-4" />
                    升级企业版
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* 额度使用情况 */}
      <div className="max-w-[900px] mx-auto px-4 -mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 下载额度 */}
          <UsageCard
            icon={<Download className="w-5 h-5" />}
            title="今日下载"
            used={usage?.downloads.usedToday ?? 0}
            limit={usage?.downloads.dailyLimit ?? -1}
            color="blue"
            delay={0}
          />
          {/* AI 生成额度 */}
          <UsageCard
            icon={<Sparkles className="w-5 h-5" />}
            title="AI 生成"
            used={usage?.aiGenerate.usedToday ?? 0}
            limit={usage?.aiGenerate.dailyLimit ?? -1}
            color="purple"
            delay={0.05}
          />
          {/* 存储空间 */}
          <UsageCard
            icon={<HardDrive className="w-5 h-5" />}
            title="存储空间"
            used={usage?.storage.usedMB ?? 0}
            limit={usage?.storage.limitMB ?? 2000}
            unit="MB"
            color="green"
            delay={0.1}
            percent={usage?.storage.usagePercent ?? 0}
          />
          {/* 收藏/上传 */}
          <div className="motion-div" style={{ animationDelay: "0.15s" }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-[var(--color-surface-soft)] rounded-2xl p-5 border border-[var(--color-hairline)]"
            >
              <div className="flex items-center gap-2 mb-4 text-amber-600">
                <Heart className="w-5 h-5" />
                <span className="text-sm font-medium text-[var(--color-ink)]">我的数据</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--color-mute)]">收藏</span>
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{usage?.favorites ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--color-mute)]">上传</span>
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{usage?.uploads ?? 0}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* 会员特权列表 */}
      <div className="max-w-[900px] mx-auto px-4 py-10">
        <h2 className="text-xl font-bold text-[var(--color-ink)] mb-6">会员特权</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <BenefitCard
            icon={<Download className="w-5 h-5" />}
            title="无限下载"
            desc={tierName === "免费版" ? "5 次/天" : "不限次数"}
            active={tierName !== "免费版"}
          />
          <BenefitCard
            icon={<Crown className="w-5 h-5" />}
            title="4K/8K 超清"
            desc={tierName === "免费版" ? "标准分辨率" : "最高分辨率"}
            active={tierName !== "免费版"}
          />
          <BenefitCard
            icon={<Sparkles className="w-5 h-5" />}
            title="AI 生成"
            desc={tierName === "企业版" || isAdmin ? "无限次" : tierName === "Pro" ? "30 次/天" : "3 次/天"}
            active={true}
          />
          <BenefitCard
            icon={<HardDrive className="w-5 h-5" />}
            title="存储空间"
            desc={`${tierName === "免费版" ? 500 : tierName === "管理员" ? 10000 : 2000} MB`}
            active={tierName !== "免费版"}
          />
          <BenefitCard
            icon={<Zap className="w-5 h-5" />}
            title="无广告体验"
            desc={tierName === "免费版" ? "含广告" : "纯净浏览"}
            active={tierName !== "免费版"}
          />
          <BenefitCard
            icon={<Upload className="w-5 h-5" />}
            title="专属合集"
            desc={tierName === "免费版" ? "不可用" : "创建专属合集"}
            active={tierName !== "免费版"}
          />
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="max-w-[900px] mx-auto px-4 pb-16">
        <h2 className="text-xl font-bold text-[var(--color-ink)] mb-6">快捷入口</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink icon={<Sparkles className="w-5 h-5" />} label="AI 生成" href="/ai-generate" />
          <QuickLink icon={<Upload className="w-5 h-5" />} label="上传壁纸" href="/upload" />
          <QuickLink icon={<Heart className="w-5 h-5" />} label="我的收藏" href="/profile" />
          <QuickLink icon={<Crown className="w-5 h-5" />} label="定价方案" href="/pricing" />
        </div>
      </div>

      {/* 支付弹窗 */}
      <PaymentDialog
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        orderType="membership"
        description={`ImageGallery ${selectedPlan.includes("yearly") ? "年付" : "月付"}${selectedPlan.includes("enterprise") ? "企业版" : "Pro"}会员`}
        amount={selectedAmount}
        plan={selectedPlan}
        onSuccess={() => {
          setPaymentOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}

// === 额度使用卡片 ===
function UsageCard({
  icon,
  title,
  used,
  limit,
  unit = "次",
  color,
  delay,
  percent,
}: {
  icon: React.ReactNode;
  title: string;
  used: number;
  limit: number;
  unit?: string;
  color: "blue" | "purple" | "green";
  delay: number;
  percent?: number;
}) {
  const isUnlimited = limit === -1;
  const usagePercent = percent ?? (isUnlimited ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 0);

  const colorMap = {
    blue: { bg: "bg-blue-50 dark:bg-blue-900/10", bar: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
    purple: { bg: "bg-purple-50 dark:bg-purple-900/10", bar: "bg-purple-500", text: "text-purple-600 dark:text-purple-400" },
    green: { bg: "bg-green-50 dark:bg-green-900/10", bar: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  };

  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-2xl p-5 border border-[var(--color-hairline)] ${c.bg}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={c.text}>{icon}</span>
        <span className="text-sm font-medium text-[var(--color-ink)]">{title}</span>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-2xl font-bold text-[var(--color-ink)]">{used}</span>
        <span className="text-sm text-[var(--color-mute)]">
          / {isUnlimited ? "∞" : `${limit}`} {unit === "MB" ? "MB" : ""}
        </span>
      </div>
      {/* 进度条 */}
      {!isUnlimited && (
        <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-500`}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="flex items-center gap-1 text-xs text-[var(--color-mute)]">
          <Infinity className="w-3.5 h-3.5" />
          无限制
        </div>
      )}
    </motion.div>
  );
}

// === 特权卡片 ===
function BenefitCard({
  icon,
  title,
  desc,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border ${
        active
          ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
          : "bg-[var(--color-surface-soft)] border-[var(--color-hairline)] opacity-60"
      }`}
    >
      <span className={active ? "text-amber-500" : "text-[var(--color-mute)]"}>{icon}</span>
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="text-xs text-[var(--color-mute)]">{desc}</p>
      </div>
    </div>
  );
}

// === 快捷入口 ===
function QuickLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline)] hover:bg-[var(--color-surface-card)] transition-colors text-left"
    >
      <span className="text-[var(--color-mute)]">{icon}</span>
      <span className="text-sm font-medium text-[var(--color-ink)] flex-1">{label}</span>
      <ArrowRight className="w-4 h-4 text-[var(--color-mute)]" />
    </button>
  );
}