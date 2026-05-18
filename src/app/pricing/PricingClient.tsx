"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Crown, Building, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export default function PricingClient() {
  const [annual, setAnnual] = useState(false);

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
                    <Badge className="bg-[var(--color-primary)] text-white px-3">最受欢迎</Badge>
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
                  variant={plan.popular ? "default" : "outline"} disabled={plan.disabled}>
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
    </div>
  );
}