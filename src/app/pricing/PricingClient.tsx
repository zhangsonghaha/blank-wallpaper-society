"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Check, X, Crown, Building, Sparkles, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PaymentDialog from "@/components/PaymentDialog";

const PLANS = [
  {
    id: "free", name: "免费版", price: 0, period: "", icon: Sparkles,
    color: "text-gray-500", bgColor: "bg-gray-50 dark:bg-gray-900/10",
    borderColor: "border-gray-200 dark:border-gray-800",
    description: "基础体验，适合偶尔使用",
    features: [
      { text: "5 次下载/天", included: true }, { text: "标准分辨率", included: true },
      { text: "基础搜索", included: true }, { text: "3 次 AI 生成/天", included: true },
      { text: "4K/8K 分辨率", included: false }, { text: "无广告体验", included: false },
      { text: "专属合集", included: false }, { text: "优先支持", included: false },
    ],
    cta: "当前方案", disabled: true,
  },
  {
    id: "pro", name: "Pro 会员", price: 19.9, period: "/月", icon: Crown,
    color: "text-amber-500", bgColor: "bg-amber-50/50 dark:bg-amber-900/10",
    borderColor: "border-amber-200 dark:border-amber-800",
    description: "无限下载，高清体验", popular: true,
    features: [
      { text: "无限下载", included: true }, { text: "4K/8K 分辨率", included: true },
      { text: "高级搜索过滤", included: true }, { text: "30 次 AI 生成/天", included: true },
      { text: "无广告体验", included: true }, { text: "专属合集", included: true },
      { text: "优先支持", included: true }, { text: "API 访问", included: false },
    ],
    cta: "立即升级", disabled: false,
  },
  {
    id: "enterprise", name: "企业版", price: 99, period: "/月", icon: Building,
    color: "text-blue-500", bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "无限 API，团队协作",
    features: [
      { text: "无限下载", included: true }, { text: "原始分辨率", included: true },
      { text: "高级搜索过滤", included: true }, { text: "无限 AI 生成", included: true },
      { text: "无广告体验", included: true }, { text: "专属合集", included: true },
      { text: "专属支持 + SLA", included: true }, { text: "无限 API 调用", included: true },
    ],
    cta: "联系销售", disabled: false,
  },
];

// 会员权益列表
const MEMBERSHIP_BENEFITS = [
  { icon: "♾️", title: "无限下载", desc: "每天不限次数下载" },
  { icon: "🖼️", title: "4K/8K 超清", desc: "最高分辨率壁纸" },
  { icon: "🔍", title: "高级搜索", desc: "多维度过滤筛选" },
  { icon: "🤖", title: "AI 生成", desc: "30次/天 AI 创作" },
  { icon: "🚫", title: "无广告", desc: "纯净浏览体验" },
  { icon: "📚", title: "专属合集", desc: "会员精选合集" },
  { icon: "⚡", title: "优先支持", desc: "专属客服通道" },
];

function getPlanLabel(plan: string) {
  switch (plan) {
    case "monthly": return "Pro 月付";
    case "yearly": return "Pro 年付";
    case "enterprise_monthly": return "企业版月付";
    case "enterprise_yearly": return "企业版年付";
    default: return plan;
  }
}

export default function PricingClient() {
  const { data: session } = useSession();
  const [annual, setAnnual] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly" | "enterprise_monthly" | "enterprise_yearly">("monthly");
  const [selectedAmount, setSelectedAmount] = useState(19.9);

  const isAdmin = (session?.user as any)?.role === "admin";
  const membership = (session?.user as any)?.membership as { plan: string; startedAt: string; expiresAt: string; status: string } | null | undefined;
  const isMember = !!membership && membership.status === "active";

  // 获取当前会员对应的方案ID
  const currentPlanId = membership?.plan?.includes("enterprise") ? "enterprise" : "pro";

  // 管理员视图
  if (isAdmin) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)]">
        <div className="text-center py-16 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-red-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-4">管理员特权</h1>
            <p className="text-lg text-[var(--color-mute)] max-w-[600px] mx-auto mb-8">
              您拥有最高权限，无需订阅会员即可享受所有功能
            </p>
            <Badge className="bg-gradient-to-r from-amber-500 to-red-500 text-white text-base px-6 py-2 rounded-full">
              <Shield className="w-4 h-4 mr-1.5" />
              最高权限 · 全功能开放
            </Badge>
          </motion.div>
        </div>

        <div className="max-w-[800px] mx-auto px-4 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {MEMBERSHIP_BENEFITS.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-[var(--color-surface-soft)] text-center"
              >
                <span className="text-2xl mb-2 block">{b.icon}</span>
                <p className="text-sm font-medium text-[var(--color-ink)]">{b.title}</p>
                <p className="text-xs text-[var(--color-mute)]">{b.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-900/10 dark:to-red-900/10 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-[var(--color-ink)]">管理员专属能力</h3>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-[var(--color-mute)]">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />用户管理与审核</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />图片审核与删除</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />订单确认与拒绝</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />系统设置管理</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />数据统计与监控</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />机器人配置管理</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // 已订阅会员的用户视图
  if (isMember) {
    const expiresDate = membership.expiresAt
      ? new Date(membership.expiresAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
      : "";

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)]">
        <div className="text-center py-16 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-4">
              {currentPlanId === "enterprise" ? "企业版" : "Pro"} 会员
            </h1>
            <p className="text-lg text-[var(--color-mute)] max-w-[600px] mx-auto mb-6">
              您正在享受 {getPlanLabel(membership.plan)} 专属权益
            </p>
            <div className="flex items-center justify-center gap-3">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm px-4 py-1.5 rounded-full">
                <Crown className="w-3.5 h-3.5 mr-1" />
                {getPlanLabel(membership.plan)}
              </Badge>
              {expiresDate && (
                <Badge variant="outline" className="text-sm px-4 py-1.5 rounded-full">
                  到期: {expiresDate}
                </Badge>
              )}
            </div>
          </motion.div>
        </div>

        <div className="max-w-[800px] mx-auto px-4 pb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {MEMBERSHIP_BENEFITS.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-[var(--color-surface-soft)] text-center"
              >
                <span className="text-2xl mb-2 block">{b.icon}</span>
                <p className="text-sm font-medium text-[var(--color-ink)]">{b.title}</p>
                <p className="text-xs text-[var(--color-mute)]">{b.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* 续费/升级按钮 */}
          <div className="flex items-center justify-center gap-4">
            <Button
              onClick={() => {
                setSelectedPlan(annual ? "yearly" : "monthly");
                setSelectedAmount(annual ? 149 : 19.9);
                setPaymentOpen(true);
              }}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white gap-1.5"
            >
              <Crown className="w-4 h-4" />
              续费 Pro
            </Button>
            {currentPlanId !== "enterprise" && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPlan(annual ? "enterprise_yearly" : "enterprise_monthly");
                  setSelectedAmount(annual ? 950 : 99);
                  setPaymentOpen(true);
                }}
                className="rounded-full gap-1.5"
              >
                <Building className="w-4 h-4" />
                升级企业版
              </Button>
            )}
          </div>
        </div>

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

  // 普通用户视图（未订阅）
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-surface-card)]">
      <div className="text-center py-16 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--color-ink)] mb-4">选择你的方案</h1>
          <p className="text-lg text-[var(--color-mute)] max-w-[600px] mx-auto mb-8">
            从免费开始，随时升级。Pro 会员解锁无限下载和高清壁纸体验。
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${!annual ? "text-[var(--color-ink)] font-medium" : "text-[var(--color-mute)]"}`}>月付</span>
            <button onClick={() => setAnnual(!annual)} className={`relative w-12 h-6 rounded-full transition-colors ${annual ? "bg-[var(--color-primary)]" : "bg-[var(--color-surface-hover)]"}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
            <span className={`text-sm ${annual ? "text-[var(--color-ink)] font-medium" : "text-[var(--color-mute)]"}`}>
              年付 <Badge variant="secondary" className="ml-1 text-xs">省20%</Badge>
            </span>
          </div>
        </motion.div>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const PlanIcon = plan.icon;
            const price = annual ? plan.price * 12 * 0.8 : plan.price;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border ${plan.borderColor} bg-[var(--color-surface-soft)] p-6 flex flex-col ${plan.popular ? "ring-2 ring-[var(--color-primary)] shadow-xl scale-[1.02]" : "shadow"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[var(--color-primary)] text-white dark:bg-white dark:text-black px-3">最受欢迎</Badge>
                  </div>
                )}
                <div className="mb-6">
                  <div className={`w-10 h-10 rounded-xl ${plan.bgColor} flex items-center justify-center mb-3`}>
                    <PlanIcon className={`w-5 h-5 ${plan.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-[var(--color-ink)]">{plan.name}</h3>
                  <p className="text-sm text-[var(--color-mute)] mt-1">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-[var(--color-ink)]">¥{price === 0 ? "0" : price.toFixed(annual ? 0 : 1)}</span>
                  {plan.period && <span className="text-[var(--color-mute)]">{annual ? "/年" : plan.period}</span>}
                </div>
                <div className="flex-1 space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="flex items-center gap-2">
                      {feature.included ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> : <X className="w-4 h-4 text-[var(--color-mute)] flex-shrink-0" />}
                      <span className={`text-sm ${feature.included ? "text-[var(--color-ink)]" : "text-[var(--color-mute)]"}`}>{feature.text}</span>
                    </div>
                  ))}
                </div>
                <Button className={`w-full rounded-full ${plan.popular ? "" : "bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90"}`}
                  variant={plan.popular ? "default" : "outline"} disabled={plan.disabled}
                  onClick={() => {
                    if (plan.id === "pro") {
                      setSelectedPlan(annual ? "yearly" : "monthly");
                      setSelectedAmount(annual ? 149 : 19.9);
                      setPaymentOpen(true);
                    } else if (plan.id === "enterprise") {
                      setSelectedPlan(annual ? "enterprise_yearly" : "enterprise_monthly");
                      setSelectedAmount(annual ? 950 : 99);
                      setPaymentOpen(true);
                    }
                  }}>
                  {plan.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-8">常见问题</h2>
          <div className="max-w-[600px] mx-auto space-y-4 text-left">
            {[
              { q: "可以随时取消订阅吗？", a: "可以。取消后当前周期内仍可使用 Pro 功能，到期后自动降级为免费版。" },
              { q: "年付如何退款？", a: "年付方案支持7天内无理由退款，超过7天按剩余月份比例退款。" },
              { q: "免费用户有下载限制吗？", a: "免费用户每天可下载5张标准分辨率壁纸，升级 Pro 可无限下载4K/8K壁纸。" },
              { q: "AI 生成次数如何计算？", a: "每日0点重置。免费用户3次/天，Pro 会员30次/天，企业版无限。" },
            ].map((faq, i) => (
              <div key={i} className="p-4 rounded-xl bg-[var(--color-surface-elevated)]">
                <h4 className="font-medium text-[var(--color-ink)] mb-1">{faq.q}</h4>
                <p className="text-sm text-[var(--color-mute)]">{faq.a}</p>
              </div>
            ))}
          </div>
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