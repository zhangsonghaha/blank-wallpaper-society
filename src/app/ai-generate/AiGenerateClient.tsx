"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Wand2, Download, Clock, Loader2, Image as ImageIcon,
  Palette, Monitor, Smartphone, Square, RectangleHorizontal,
  RectangleVertical, CheckCircle, XCircle, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AI_STYLES: Record<string, { name: string; emoji: string; color: string }> = {
  realistic: { name: "写实", emoji: "📷", color: "bg-blue-100 text-blue-700 border-blue-200" },
  anime: { name: "动漫", emoji: "🎨", color: "bg-pink-100 text-pink-700 border-pink-200" },
  abstract: { name: "抽象", emoji: "🌀", color: "bg-purple-100 text-purple-700 border-purple-200" },
  oil_painting: { name: "油画", emoji: "🖼️", color: "bg-amber-100 text-amber-700 border-amber-200" },
  watercolor: { name: "水彩", emoji: "💧", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  cyberpunk: { name: "赛博朋克", emoji: "🌃", color: "bg-violet-100 text-violet-700 border-violet-200" },
  nature: { name: "自然风光", emoji: "🏔️", color: "bg-green-100 text-green-700 border-green-200" },
  minimalist: { name: "极简", emoji: "⬜", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const SIZE_PRESETS = [
  { id: "desktop", label: "桌面", icon: Monitor, width: 1920, height: 1080, desc: "1920×1080" },
  { id: "mobile", label: "手机", icon: Smartphone, width: 1080, height: 1920, desc: "1080×1920" },
  { id: "ultrawide", label: "超宽", icon: RectangleHorizontal, width: 2048, height: 1080, desc: "2048×1080" },
  { id: "square", label: "方形", icon: Square, width: 1024, height: 1024, desc: "1024×1024" },
];

const PROMPT_EXAMPLES = [
  "一片宁静的湖泊倒映着雪山，清晨金色阳光",
  "深空星云中漂浮的水晶宫殿，科幻风格",
  "樱花树下的日本古镇，雨后彩虹",
  "未来城市的夜景，霓虹灯映照在雨后的街道",
  "热带海滩日落，棕榈树剪影，橙红色天空",
  "迷雾中的古堡，哥特式建筑，月光照耀",
];

interface Generation {
  id: number;
  prompt: string;
  style: string;
  width: number;
  height: number;
  status: string;
  result_url: string;
  error_message: string;
  model: string;
  tokens_used: number;
  created_at: string;
  completed_at: string;
}

export default function AiGenerateClient() {
  const { data: session, status: authStatus } = useSession();
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("realistic");
  const [selectedSize, setSelectedSize] = useState("desktop");
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("create");

  const fetchHistory = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/ai-generate?limit=20");
      if (res.ok) {
        const data = await res.json();
        setGenerations(data.data || []);
      }
    } catch (err) {
      console.error("获取生成历史失败:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchHistory();
    }
  }, [authStatus, fetchHistory]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("请输入描述文字");
      return;
    }
    if (authStatus !== "authenticated") {
      toast.error("请先登录");
      return;
    }

    const size = SIZE_PRESETS.find((s) => s.id === selectedSize) || SIZE_PRESETS[0];
    setGenerating(true);

    try {
      const res = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style: selectedStyle,
          width: size.width,
          height: size.height,
          model: "dall-e",
        }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success("壁纸生成成功！");
        setGenerations((prev) => [
          {
            id: data.data.generationId,
            prompt: prompt.trim(),
            style: selectedStyle,
            width: size.width,
            height: size.height,
            status: "completed",
            result_url: data.data.imageUrl,
            error_message: "",
            model: "dall-e",
            tokens_used: 1,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setActiveTab("history");
      } else {
        toast.error(data.error || "生成失败");
      }
    } catch {
      toast.error("生成失败，请检查网络连接");
    } finally {
      setGenerating(false);
    }
  };

  const fillExample = (example: string) => {
    setPrompt(example);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
      {/* 页面头部 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-purple-500" /> AI 壁纸生成
        </h1>
        <p className="text-sm text-[var(--color-mute)] mt-1">
          描述你想要的壁纸，AI 为你创造独一无二的作品
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="create" className="flex items-center gap-1.5">
            <Wand2 className="w-4 h-4" /> 创建壁纸
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> 生成历史
          </TabsTrigger>
        </TabsList>

        {/* ===== 创建壁纸 ===== */}
        <TabsContent value="create">
          {authStatus !== "authenticated" ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-[var(--color-mute)] text-lg">请先登录使用 AI 生成功能</p>
                <p className="text-sm text-[var(--color-mute)] mt-2">登录后可无限生成个性化壁纸</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：配置面板 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 提示词输入 */}
                <Card>
                  <CardContent className="p-5">
                    <Label className="text-base font-semibold mb-3 block">描述你想要的壁纸</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="描述你想要的壁纸画面，越详细效果越好..."
                      rows={4}
                      className="resize-none text-base"
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-[var(--color-mute)]">
                        {prompt.length}/500
                      </span>
                      {prompt.trim().length === 0 && (
                        <span className="text-xs text-[var(--color-mute)]">试试下面的示例 →</span>
                      )}
                    </div>

                    {/* 示例提示词 */}
                    <div className="mt-3">
                      <p className="text-xs text-[var(--color-mute)] mb-2">快速填入示例：</p>
                      <div className="flex flex-wrap gap-1.5">
                        {PROMPT_EXAMPLES.map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => fillExample(ex)}
                            className="px-2.5 py-1 text-xs rounded-full bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)] transition-colors truncate max-w-[200px]"
                          >
                            {ex.slice(0, 15)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 风格选择 */}
                <Card>
                  <CardContent className="p-5">
                    <Label className="text-base font-semibold mb-3 block flex items-center gap-1.5">
                      <Palette className="w-4 h-4" /> 选择风格
                    </Label>
                    <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                      {Object.entries(AI_STYLES).map(([key, style]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedStyle(key)}
                          className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                            selectedStyle === key
                              ? "border-[var(--color-ink)] shadow-sm"
                              : "border-transparent hover:border-gray-200"
                          }`}
                        >
                          <div className="text-2xl mb-1">{style.emoji}</div>
                          <div className="text-xs font-medium">{style.name}</div>
                          {selectedStyle === key && (
                            <div className="absolute top-1.5 right-1.5">
                              <CheckCircle className="w-4 h-4 text-[var(--color-ink)]" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* 尺寸选择 */}
                <Card>
                  <CardContent className="p-5">
                    <Label className="text-base font-semibold mb-3 block flex items-center gap-1.5">
                      <Monitor className="w-4 h-4" /> 选择尺寸
                    </Label>
                    <div className="grid grid-cols-4 gap-2">
                      {SIZE_PRESETS.map((size) => {
                        const Icon = size.icon;
                        return (
                          <button
                            key={size.id}
                            onClick={() => setSelectedSize(size.id)}
                            className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                              selectedSize === size.id
                                ? "border-[var(--color-ink)] shadow-sm"
                                : "border-transparent hover:border-gray-200"
                            }`}
                          >
                            <Icon className="w-6 h-6 mx-auto mb-1 text-[var(--color-ink)]" />
                            <div className="text-xs font-medium">{size.label}</div>
                            <div className="text-[10px] text-[var(--color-mute)]">{size.desc}</div>
                            {selectedSize === size.id && (
                              <div className="absolute top-1.5 right-1.5">
                                <CheckCircle className="w-4 h-4 text-[var(--color-ink)]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 右侧：预览和生成 */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-[var(--color-ink)] mb-4">生成预览</h3>
                    {/* 预览区域 */}
                    <div className="relative bg-[var(--color-surface-card)] rounded-xl overflow-hidden mb-4 flex items-center justify-center"
                      style={{
                        aspectRatio: `${SIZE_PRESETS.find((s) => s.id === selectedSize)?.width || 1920} / ${SIZE_PRESETS.find((s) => s.id === selectedSize)?.height || 1080}`,
                        maxHeight: 300,
                      }}
                    >
                      {generating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-500/10 to-blue-500/10">
                          <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-3" />
                          <p className="text-sm font-medium text-purple-600">AI 创作中...</p>
                          <p className="text-xs text-[var(--color-mute)] mt-1">通常需要 10-30 秒</p>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <Wand2 className="w-12 h-12 mx-auto mb-3 opacity-15" />
                          <p className="text-sm text-[var(--color-mute)]">输入描述后点击生成</p>
                        </div>
                      )}
                    </div>

                    {/* 配置摘要 */}
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-mute)]">风格</span>
                        <Badge className={AI_STYLES[selectedStyle]?.color}>
                          {AI_STYLES[selectedStyle]?.emoji} {AI_STYLES[selectedStyle]?.name}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-mute)]">尺寸</span>
                        <span className="font-medium">
                          {SIZE_PRESETS.find((s) => s.id === selectedSize)?.desc}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-mute)]">模型</span>
                        <span className="font-medium">DALL-E 3</span>
                      </div>
                    </div>

                    {/* 生成按钮 */}
                    <Button
                      className="w-full text-base py-6"
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || generating}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          生成壁纸
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* 提示信息 */}
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-sm text-[var(--color-ink)] mb-2">使用提示</h4>
                    <ul className="text-xs text-[var(--color-mute)] space-y-1.5">
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-500 mt-0.5">•</span>
                        描述越详细，生成效果越好
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-500 mt-0.5">•</span>
                        可以指定颜色、氛围、构图等细节
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-500 mt-0.5">•</span>
                        不同风格会产生截然不同的效果
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-purple-500 mt-0.5">•</span>
                        生成的壁纸可下载设为桌面背景
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===== 生成历史 ===== */}
        <TabsContent value="history">
          {authStatus !== "authenticated" ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-[var(--color-mute)] text-lg">请先登录查看生成历史</p>
              </CardContent>
            </Card>
          ) : historyLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-mute)]" />
            </div>
          ) : generations.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-[var(--color-mute)] text-lg">还没有生成记录</p>
                <p className="text-sm text-[var(--color-mute)] mt-2">去创建你的第一张 AI 壁纸吧！</p>
                <Button className="mt-4" onClick={() => setActiveTab("create")}>
                  <Wand2 className="w-4 h-4 mr-1" /> 开始创建
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
              {generations.map((gen, idx) => (
                <motion.div
                  key={gen.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                >
                  <div className="break-inside-avoid rounded-xl overflow-hidden bg-[var(--color-surface-card)] shadow-sm hover:shadow-md transition-shadow group">
                    <div className="relative">
                      {gen.status === "completed" && gen.result_url ? (
                        <img
                          src={gen.result_url}
                          alt={gen.prompt}
                          className="w-full h-auto"
                          loading="lazy"
                        />
                      ) : gen.status === "processing" ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-purple-50 to-blue-50">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-2" />
                          <p className="text-xs text-purple-600">生成中...</p>
                        </div>
                      ) : gen.status === "failed" ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-red-50">
                          <XCircle className="w-8 h-8 text-red-400 mb-2" />
                          <p className="text-xs text-red-500">生成失败</p>
                          <p className="text-xs text-red-400 mt-1 px-4 text-center line-clamp-2">{gen.error_message}</p>
                        </div>
                      ) : null}

                      {/* 下载按钮 */}
                      {gen.status === "completed" && gen.result_url && (
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={gen.result_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-white/90 rounded-full text-xs font-semibold text-[var(--color-ink)] hover:bg-white transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> 下载
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="text-sm font-medium text-[var(--color-ink)] line-clamp-2">
                        {gen.prompt}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {AI_STYLES[gen.style] && (
                          <Badge variant="secondary" className="text-[10px]">
                            {AI_STYLES[gen.style].emoji} {AI_STYLES[gen.style].name}
                          </Badge>
                        )}
                        <span className="text-[10px] text-[var(--color-mute)]">
                          {gen.width}×{gen.height}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--color-mute)] mt-1.5">
                        {new Date(gen.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}