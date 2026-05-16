"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Upload, Heart, Grid3X3, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const ONBOARDING_KEY = "onboarding_completed";

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

const steps: Step[] = [
  {
    icon: Search,
    title: "发现灵感",
    description: "搜索浏览数万张精选高清壁纸，从自然风光到城市建筑，找到属于你的视觉灵感。",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Heart,
    title: "收藏与下载",
    description: "一键收藏喜爱的壁纸，创建专属合集，支持多种分辨率下载。",
    color: "bg-red-50 text-red-600",
  },
  {
    icon: Upload,
    title: "分享你的作品",
    description: "上传你的摄影作品和壁纸创作，让更多人看到你的精彩内容。",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: Sparkles,
    title: "AI 生成壁纸",
    description: "使用 AI 创作独一无二的壁纸，输入描述即可生成专属壁纸。",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Grid3X3,
    title: "合集与挑战",
    description: "创建主题合集，参与社区挑战赛，与创作者互动交流。",
    color: "bg-amber-50 text-amber-600",
  },
];

export default function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // 检查是否已完成引导
    try {
      const completed = localStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        // 延迟显示，等页面加载完成
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleClose = () => {
    setVisible(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {}
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  if (!visible) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-[var(--color-surface-soft)] rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 进度条 */}
            <div className="h-1 bg-[var(--color-surface-card)]">
              <motion.div
                className="h-full bg-[var(--color-primary)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* 关闭按钮 */}
            <div className="flex justify-end p-3">
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-mute)]" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="px-8 pb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  {/* 图标 */}
                  <div className={`w-16 h-16 mx-auto mb-5 rounded-2xl ${step.color} flex items-center justify-center`}>
                    <StepIcon className="w-8 h-8" />
                  </div>

                  {/* 标题和描述 */}
                  <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[var(--color-mute)] leading-relaxed mb-8">
                    {step.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* 步骤指示器 */}
              <div className="flex justify-center gap-1.5 mb-6">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? "w-6 bg-[var(--color-primary)]"
                        : i < currentStep
                        ? "w-1.5 bg-[var(--color-primary)]/50"
                        : "w-1.5 bg-[var(--color-surface-card)]"
                    }`}
                  />
                ))}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 rounded-full"
                >
                  跳过
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-1 rounded-full gap-1"
                >
                  {currentStep < steps.length - 1 ? (
                    <>
                      下一步
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    "开始探索"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}