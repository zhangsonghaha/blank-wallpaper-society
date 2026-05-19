"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  Clock,
  Copy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 订单类型 */
  orderType: "paid_wallpaper" | "tip" | "membership";
  /** 订单描述 */
  description: string;
  /** 金额 */
  amount: number;
  /** 关联ID（壁纸ID/打赏对象等） */
  relatedId?: number;
  /** 套餐类型（会员订阅时使用） */
  plan?: "monthly" | "yearly" | "enterprise_monthly" | "enterprise_yearly";
  /** 支付成功回调 */
  onSuccess?: (orderId: number) => void;
}

type PaymentStep = "confirm" | "paying" | "waiting" | "success";

export default function PaymentDialog({
  isOpen,
  onClose,
  orderType,
  description,
  amount,
  relatedId,
  plan,
  onSuccess,
}: PaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>("confirm");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [orderNo, setOrderNo] = useState<string>("");
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // 收款码路径
  const qrCodeSrc = "/sk.jpg";

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setStep("confirm");
      setOrderId(null);
      setOrderNo("");
      setPolling(false);
      setPollCount(0);
    }
  }, [isOpen]);

  // 轮询订单状态
  useEffect(() => {
    if (!polling || !orderId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.payment_status === "paid") {
            setPolling(false);
            setStep("success");
            toast.success("支付成功！");
            if (onSuccess) onSuccess(orderId);
            return;
          }
        }
        setPollCount((c) => c + 1);
        // 超过60次轮询（约5分钟）停止
        if (pollCount >= 60) {
          setPolling(false);
          toast.info("等待确认超时，请稍后在订单中查看状态");
        }
      } catch {
        // 静默失败继续轮询
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [polling, orderId, pollCount, onSuccess]);

  // 创建订单并进入支付
  const handleCreateOrder = async () => {
    setStep("paying");
    try {
      const body: Record<string, any> = {
        type: orderType,
        amount,
      };

      if (orderType === "paid_wallpaper" && relatedId) {
        body.image_id = relatedId;
      } else if (orderType === "tip" && relatedId) {
        body.to_user_id = relatedId;
      } else if (orderType === "membership" && plan) {
        body.plan = plan;
      }

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "创建订单失败");
      }

      const data = await res.json();
      setOrderId(data.data.id);
      setOrderNo(data.data.order_no);
      setStep("waiting");
      setPolling(true);
    } catch (error: any) {
      toast.error(error.message || "创建订单失败");
      setStep("confirm");
    }
  };

  // 复制订单号
  const copyOrderNo = () => {
    navigator.clipboard.writeText(orderNo).then(() => {
      toast.success("订单号已复制");
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--color-canvas,#fff)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-hairline,#e5e5e5)]">
              <h3 className="text-lg font-semibold text-[var(--color-ink,#1a1a1a)]">
                {step === "confirm" && "确认支付"}
                {step === "paying" && "创建订单中..."}
                {step === "waiting" && "扫码支付"}
                {step === "success" && "支付成功"}
              </h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-soft,#f5f5f5)] text-[var(--color-ink,#1a1a1a)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Step: Confirm */}
              {step === "confirm" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--color-surface-soft,#f5f5f5)]">
                    <p className="text-sm text-[var(--color-ash,#999)] mb-1">商品</p>
                    <p className="text-[var(--color-ink,#1a1a1a)] font-medium">{description}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-soft,#f5f5f5)]">
                    <span className="text-sm text-[var(--color-ash,#999)]">支付金额</span>
                    <span className="text-2xl font-bold text-[var(--color-primary,#e5002d)]">
                      ¥{amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="text-xs">
                      支付方式为扫码转账，请使用微信或支付宝扫描收款码完成支付。支付后系统将自动确认。
                    </p>
                  </div>
                  <button
                    onClick={handleCreateOrder}
                    className="w-full py-3 rounded-xl bg-[var(--color-primary,#e5002d)] text-white font-medium hover:bg-[var(--color-primary-pressed,#c5001d)] transition-colors"
                  >
                    立即支付 ¥{amount.toFixed(2)}
                  </button>
                </div>
              )}

              {/* Step: Paying */}
              {step === "paying" && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary,#e5002d)] mb-3" />
                  <p className="text-sm text-[var(--color-ash,#999)]">正在创建订单...</p>
                </div>
              )}

              {/* Step: Waiting for payment */}
              {step === "waiting" && (
                <div className="space-y-4">
                  {/* QR Code */}
                  <div className="flex flex-col items-center py-4">
                    <div className="w-56 h-56 rounded-xl border-2 border-dashed border-[var(--color-hairline,#e5e5e5)] flex items-center justify-center bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeSrc}
                        alt="收款码"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="mt-3 text-sm text-[var(--color-ink,#1a1a1a)] font-medium">
                      请扫码支付
                      <span className="text-[var(--color-primary,#e5002d)] ml-1">
                        ¥{amount.toFixed(2)}
                      </span>
                    </p>
                  </div>

                  {/* Order info */}
                  <div className="p-3 rounded-lg bg-[var(--color-surface-soft,#f5f5f5)] space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-ash,#999)]">订单号</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[var(--color-ink,#1a1a1a)] font-mono text-xs">
                          {orderNo}
                        </span>
                        <button onClick={copyOrderNo} className="text-[var(--color-primary,#e5002d)] hover:opacity-70">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-ash,#999)]">商品</span>
                      <span className="text-[var(--color-ink,#1a1a1a)]">{description}</span>
                    </div>
                  </div>

                  {/* Polling indicator */}
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-ash,#999)]">
                    {polling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>等待支付确认中...</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>等待确认</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Step: Success */}
              {step === "success" && (
                <div className="flex flex-col items-center py-6 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-green-500" />
                  <p className="text-lg font-semibold text-[var(--color-ink,#1a1a1a)]">
                    支付成功！
                  </p>
                  <p className="text-sm text-[var(--color-ash,#999)]">
                    {orderType === "paid_wallpaper"
                      ? "已解锁该壁纸，现在可以下载了"
                      : orderType === "membership"
                        ? "会员已激活，享受专属权益"
                        : "打赏已送达"}
                  </p>
                  {orderType === "membership" && (
                    <div className="w-full mt-2 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                      <p className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        已解锁会员权益
                      </p>
                      <ul className="space-y-1 text-xs text-amber-600">
                        <li>• 无限下载 4K/8K 超清壁纸</li>
                        <li>• 高级搜索过滤功能</li>
                        <li>• 每日 30 次 AI 生成</li>
                        <li>• 无广告纯净体验</li>
                        <li>• 专属合集与优先支持</li>
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className="mt-4 px-8 py-2.5 rounded-xl bg-[var(--color-primary,#e5002d)] text-white font-medium hover:bg-[var(--color-primary-pressed,#c5001d)] transition-colors"
                  >
                    完成
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}