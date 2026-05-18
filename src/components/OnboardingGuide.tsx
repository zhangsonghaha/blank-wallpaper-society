"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronRight, Upload, Heart, Grid3X3, Search, Sparkles,
  Check, Gift, UserPlus, Trophy, ArrowRight, Star, Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const ONBOARDING_KEY = "onboarding_completed";
const ONBOARDING_TASKS_KEY = "onboarding_tasks";

// ===== 引导步骤 =====
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

// ===== 新手任务 =====
interface OnboardingTask {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  reward: number; // 经验值
  completed: boolean;
}

const defaultTasks: Omit<OnboardingTask, "completed">[] = [
  {
    id: "first_download",
    icon: Heart,
    title: "下载第一张壁纸",
    description: "找到你喜欢的壁纸并下载",
    link: "/",
    reward: 10,
  },
  {
    id: "first_favorite",
    icon: Star,
    title: "收藏一张壁纸",
    description: "点击心形按钮收藏你喜爱的壁纸",
    link: "/",
    reward: 10,
  },
  {
    id: "first_upload",
    icon: Upload,
    title: "上传你的第一张作品",
    description: "分享你的摄影作品或创作",
    link: "/upload",
    reward: 30,
  },
  {
    id: "first_collection",
    icon: Grid3X3,
    title: "创建一个合集",
    description: "将收藏的壁纸整理成主题合集",
    link: "/collections",
    reward: 20,
  },
  {
    id: "follow_creator",
    icon: UserPlus,
    title: "关注一位创作者",
    description: "关注你喜欢的创作者，获取更新",
    link: "/",
    reward: 15,
  },
  {
    id: "ai_generate",
    icon: Sparkles,
    title: "体验 AI 生成壁纸",
    description: "用 AI 生成一张独一无二的壁纸",
    link: "/ai-generate",
    reward: 25,
  },
];

// ===== 空状态引导组件 =====
export function EmptyStateGuide({
  type,
  onAction,
}: {
  type: "favorites" | "uploads" | "collections" | "following";
  onAction?: () => void;
}) {
  const configs: Record<string, { icon: React.ElementType; title: string; description: string; action: string; link: string }> = {
    favorites: {
      icon: Heart,
      title: "还没有收藏",
      description: "浏览壁纸时点击心形按钮收藏你喜爱的内容，这里会显示你收藏的所有壁纸。",
      action: "去发现壁纸",
      link: "/",
    },
    uploads: {
      icon: Upload,
      title: "还没有上传作品",
      description: "分享你的摄影作品和壁纸创作，让更多人看到你的精彩内容。",
      action: "上传第一张作品",
      link: "/upload",
    },
    collections: {
      icon: Grid3X3,
      title: "还没有合集",
      description: "创建主题合集，将你收藏的壁纸按风格、场景等分类整理。",
      action: "创建第一个合集",
      link: "/collections",
    },
    following: {
      icon: UserPlus,
      title: "还没有关注任何人",
      description: "关注创作者，第一时间获取他们的最新作品更新。",
      action: "发现创作者",
      link: "/",
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[var(--color-primary)]" />
      </div>
      <h3 className="text-lg font-medium text-[var(--color-ink)] mb-2">{config.title}</h3>
      <p className="text-sm text-[var(--color-mute)] max-w-[320px] mb-6">{config.description}</p>
      <Link href={config.link} onClick={onAction}>
        <Button className="rounded-full gap-1">
          {config.action}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </motion.div>
  );
}

// ===== 新手任务面板 =====
export function OnboardingTaskPanel() {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [visible, setVisible] = useState(false);

  // 加载任务状态
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_TASKS_KEY);
      if (stored) {
        setTasks(JSON.parse(stored));
      } else {
        setTasks(defaultTasks.map((t) => ({ ...t, completed: false })));
      }
      // 仅在引导完成且未全部完成时显示任务面板
      const onboardingDone = localStorage.getItem(ONBOARDING_KEY);
      const allTasksDone = stored
        ? JSON.parse(stored).every((t: OnboardingTask) => t.completed)
        : false;
      setVisible(!!onboardingDone && !allTasksDone);
    } catch {}
  }, []);

  // 保存任务状态
  useEffect(() => {
    if (tasks.length > 0) {
      try {
        localStorage.setItem(ONBOARDING_TASKS_KEY, JSON.stringify(tasks));
      } catch {}
    }
  }, [tasks]);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalReward = tasks.reduce((sum, t) => sum + (t.completed ? t.reward : 0), 0);
  const allDone = completedCount === tasks.length;

  if (!visible || tasks.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)] p-5 mb-6"
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-ink)]">新手任务</h3>
              <p className="text-xs text-[var(--color-mute)]">
                完成任务获得经验值 ({completedCount}/{tasks.length})
              </p>
            </div>
          </div>
          {allDone && (
            <Badge className="bg-green-100 text-green-700">
              <Trophy className="w-3 h-3 mr-1" />全部完成
            </Badge>
          )}
        </div>

        {/* 进度条 */}
        <div className="h-2 bg-[var(--color-surface-card)] rounded-full mb-4">
          <motion.div
            className="h-full bg-[var(--color-primary)] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedCount / tasks.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* 任务列表 */}
        <div className="space-y-2">
          {tasks.map((task) => {
            const TaskIcon = task.icon;
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  task.completed
                    ? "bg-green-50/50 dark:bg-green-900/10"
                    : "bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  task.completed ? "bg-green-100 text-green-600" : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                }`}>
                  {task.completed ? <Check className="w-4 h-4" /> : <TaskIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.completed ? "line-through text-[var(--color-mute)]" : "text-[var(--color-ink)]"}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-[var(--color-mute)]">{task.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-600 flex items-center gap-0.5">
                    <Gift className="w-3 h-3" />+{task.reward}exp
                  </span>
                  {!task.completed && (
                    <Link href={task.link}>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 已获奖励汇总 */}
        {totalReward > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between text-sm">
            <span className="text-[var(--color-mute)]">已获得经验</span>
            <span className="font-medium text-amber-600 flex items-center gap-1">
              <Trophy className="w-4 h-4" />+{totalReward} exp
            </span>
          </div>
        )}

        {/* 全部完成后的关闭按钮 */}
        {allDone && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setVisible(false)} className="rounded-full">
              关闭任务面板
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ===== 主引导弹窗 =====
export default function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      const completed = localStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const handleClose = () => {
    setVisible(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
      // 初始化新手任务
      if (!localStorage.getItem(ONBOARDING_TASKS_KEY)) {
        localStorage.setItem(ONBOARDING_TASKS_KEY, JSON.stringify(
          defaultTasks.map((t) => ({ ...t, completed: false }))
        ));
      }
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
                  <p className="text-sm text-[var(--color-mute)] leading-relaxed mb-6">
                    {step.description}
                  </p>

                  {/* 最后一步显示任务预览 */}
                  {currentStep === steps.length - 1 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl p-4 mb-6 text-left">
                      <h4 className="text-sm font-medium text-[var(--color-ink)] mb-2 flex items-center gap-1">
                        <Rocket className="w-4 h-4 text-amber-500" />
                        完成新手任务获取经验
                      </h4>
                      <div className="space-y-1.5">
                        {defaultTasks.slice(0, 3).map((task) => {
                          const TIcon = task.icon;
                          return (
                            <div key={task.id} className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
                              <TIcon className="w-3 h-3" />
                              <span>{task.title}</span>
                              <span className="ml-auto text-amber-600">+{task.reward}exp</span>
                            </div>
                          );
                        })}
                        <p className="text-xs text-[var(--color-mute)] pt-1">还有更多任务等你完成...</p>
                      </div>
                    </div>
                  )}
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
                    <>
                      开始探索
                      <Sparkles className="w-4 h-4" />
                    </>
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