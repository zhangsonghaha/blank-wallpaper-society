"use client";

import { useState, useEffect, useCallback } from "react";
import { withCsrfHeader } from "@/lib/csrf-client";
import {
  Bug,
  Play,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Shuffle,
  ListOrdered,
  Tag,
  Link,
  Zap,
  Shield,
  Layers,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

/* ==================== 类型定义 ==================== */

interface CrawlSource {
  id: string;
  name: string;
  url: string;
  description: string;
}

interface CrawlResult {
  id: number;
  title: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  tags: string;
  category: string;
  source: string;
  media_type?: "image" | "video";
  video_url?: string;
  poster_url?: string;
  original_video_url?: string;
  original_image_url?: string;
  image_url?: string;
}

interface HistoryRecord {
  id: number;
  title: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  tags: string;
  category: string;
  created_at: string;
}

interface CrawlLog {
  id: number;
  source: string;
  source_url: string | null;
  crawl_mode: string;
  category: string | null;
  tags: string | null;
  pages: number;
  requested_count: number;
  success_count: number;
  fail_count: number;
  dedup_skipped: number;
  status: string;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
}

type CrawlStatus = "idle" | "crawling" | "processing" | "done" | "error";

/* ==================== 视频预览组件 ==================== */

function VideoPreview({ videoUrl, posterUrl }: { videoUrl: string; posterUrl: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // 视频加载失败时显示封面图或占位
  if (hasError) {
    if (posterUrl) {
      return (
        <img
          src={posterUrl}
          alt="动态壁纸封面"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <div className="text-center">
          <ImageIcon className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
          <span className="text-[10px] text-muted-foreground">视频加载失败</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <video
        src={videoUrl}
        poster={posterUrl}
        className="w-full h-full object-cover"
        muted
        loop
        preload="metadata"
        playsInline
        onLoadedData={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        onMouseEnter={(e) => {
          const video = e.currentTarget;
          video.play().catch(() => setHasError(true));
        }}
        onMouseLeave={(e) => {
          const video = e.currentTarget;
          video.pause();
          video.currentTime = 0;
        }}
      />
      {/* 未加载完成时的加载提示 */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  );
}

/* ==================== 爬虫管理组件 ==================== */

export default function CrawlTab() {
  const [sources, setSources] = useState<CrawlSource[]>([]);
  const [crawlMode, setCrawlMode] = useState<"source" | "url">("source");
  const [selectedSource, setSelectedSource] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [fetchMode, setFetchMode] = useState<"auto" | "static" | "stealthy">("auto");
  const [mode, setMode] = useState<"random" | "sequential">("random");
  const [count, setCount] = useState(5);
  const [minWidth, setMinWidth] = useState(800);
  const [pages, setPages] = useState(1);
  const [dedup, setDedup] = useState(true);
  const [manualCategory, setManualCategory] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [status, setStatus] = useState<CrawlStatus>("idle");
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [crawlLogsTotal, setCrawlLogsTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  /* ==================== 加载爬取源 ==================== */

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await fetch("/api/admin/crawl?action=sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        if (data.sources?.length > 0 && !selectedSource) {
          setSelectedSource(data.sources[0].id);
        }
      }
    } catch (err) {
      console.error("加载爬取源失败:", err);
    }
    setLoadingSources(false);
  }, [selectedSource]);

  /* ==================== 加载爬取历史 ==================== */

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/crawl?page=${historyPage}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
        setHistoryTotal(data.total || 0);
        setCrawlLogs(data.crawlLogs || []);
        setCrawlLogsTotal(data.crawlLogsTotal || 0);
      }
    } catch (err) {
      console.error("加载爬取历史失败:", err);
    }
    setLoadingHistory(false);
  }, [historyPage]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /* ==================== 开始爬取 ==================== */

  const startCrawl = async () => {
    // 验证参数
    if (crawlMode === "source" && !selectedSource) {
      toast.error("请选择爬取源");
      return;
    }
    if (crawlMode === "url" && !customUrl.trim()) {
      toast.error("请输入网页地址");
      return;
    }
    if (crawlMode === "url") {
      try {
        new URL(customUrl.trim());
      } catch {
        toast.error("请输入有效的URL地址（如 https://example.com）");
        return;
      }
    }

    setStatus("crawling");
    setProgressText(crawlMode === "url" ? "正在自适应爬取目标页面..." : "正在调用爬虫脚本...");
    setResults([]);
    setErrorMessage("");

    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(
          crawlMode === "url"
            ? {
                url: customUrl.trim(),
                fetchMode,
                count,
                minWidth,
                pages,
                dedup,
                category: manualCategory || undefined,
                tags: manualTags || undefined,
              }
            : {
                source: selectedSource,
                mode,
                count,
                pages,
                dedup,
                category: manualCategory || undefined,
                tags: manualTags || undefined,
              }
        ),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus("error");
        setErrorMessage(data.error || "爬取失败");
        toast.error(data.error || "爬取失败");
        return;
      }

      setStatus("done");
      // 优先展示未经下载上传的原始数据，方便用户确认
      setResults(data.sourceResults || data.results || []);
      toast.success(data.message || `爬取完成，成功 ${data.successCount} 张`);
      setProgressText(
        `成功: ${data.successCount} 张 | 失败: ${data.failCount} 张${data.dedupSkipped > 0 ? ` | 去重跳过: ${data.dedupSkipped} 张` : ""}`
      );

      // 刷新历史记录
      loadHistory();
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "网络请求失败");
      toast.error("爬取请求失败");
    }
  };

  /* ==================== 渲染 ==================== */

  const getStatusBadge = () => {
    switch (status) {
      case "crawling":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            爬取中
          </Badge>
        );
      case "done":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            完成
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            失败
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">
            <Clock className="w-3 h-3 mr-1" />
            待命
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 爬取配置卡片 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                壁纸爬虫
              </CardTitle>
              <CardDescription className="mt-1">
                从各大壁纸网站爬取高质量壁纸，自动上传到图库
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 爬取模式切换 */}
          <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-lg w-fit">
            <button
              onClick={() => setCrawlMode("source")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                crawlMode === "source"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              固定源
            </button>
            <button
              onClick={() => setCrawlMode("url")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                crawlMode === "url"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              自定义URL
            </button>
          </div>

          {/* ===== 自定义URL模式 ===== */}
          {crawlMode === "url" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* URL输入 */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium">目标网页地址</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="输入任意网页地址，如 https://wallhaven.cc/toplist"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--color-mute)]">
                    输入任意网页地址，自适应爬虫将自动提取页面中的图片
                  </p>
                </div>

                {/* 爬取方式 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">爬取方式</Label>
                  <Select value={fetchMode} onValueChange={(v) => setFetchMode(v as "auto" | "static" | "stealthy")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3" />
                          自动选择（推荐）
                        </div>
                      </SelectItem>
                      <SelectItem value="static">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3" />
                          静态HTTP（快速）
                        </div>
                      </SelectItem>
                      <SelectItem value="stealthy">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3 h-3" />
                          隐身浏览器（绕过反爬）
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--color-mute)]">
                    {fetchMode === "auto" ? "先静态获取，失败自动切换隐身浏览器" : fetchMode === "static" ? "仅使用HTTP请求，速度快但不支持JS渲染" : "使用隐身浏览器，可绕过Cloudflare等反爬保护"}
                  </p>
                </div>

                {/* 数量 + 最小宽度 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">每页数量</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={count}
                      onChange={(e) =>
                        setCount(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 50))
                      }
                      placeholder="1-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">最小宽度</Label>
                    <Input
                      type="number"
                      min={100}
                      max={7680}
                      step={100}
                      value={minWidth}
                      onChange={(e) =>
                        setMinWidth(Math.max(parseInt(e.target.value) || 800, 100))
                      }
                      placeholder="800"
                    />
                  </div>
                </div>

                {/* 分页 + 去重 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      连续爬取页数
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={pages}
                      onChange={(e) =>
                        setPages(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 10))
                      }
                      placeholder="1-10"
                    />
                    <p className="text-xs text-[var(--color-mute)]">
                      {pages > 1 ? `将连续爬取 ${pages} 页，预计最多 ${count * pages} 张` : "仅爬取当前页"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      去重处理
                    </Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={dedup}
                        onCheckedChange={setDedup}
                      />
                      <span className="text-sm">{dedup ? "开启" : "关闭"}</span>
                    </div>
                    <p className="text-xs text-[var(--color-mute)]">
                      {dedup ? "自动跳过已爬取的重复图片" : "不检查重复，可能导入相同图片"}
                    </p>
                  </div>
                </div>

                {/* 手动分类和标签 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      手动分类（可选）
                    </Label>
                    <Select value={manualCategory || "__auto__"} onValueChange={(v) => setManualCategory(v === "__auto__" ? "" : (v ?? ""))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="自动识别 / 选择分类" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">自动识别</SelectItem>
                        <SelectItem value="自然风光">自然风光</SelectItem>
                        <SelectItem value="城市建筑">城市建筑</SelectItem>
                        <SelectItem value="人像摄影">人像摄影</SelectItem>
                        <SelectItem value="美食">美食</SelectItem>
                        <SelectItem value="旅行">旅行</SelectItem>
                        <SelectItem value="艺术">艺术</SelectItem>
                        <SelectItem value="动物">动物</SelectItem>
                        <SelectItem value="极简">极简</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-[var(--color-mute)]">
                      网站无法自动提取分类时，使用此分类
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" />
                      手动标签（可选）
                    </Label>
                    <Input
                      type="text"
                      value={manualTags}
                      onChange={(e) => setManualTags(e.target.value)}
                      placeholder="多个标签用逗号分隔，如：风景,山脉,日落"
                    />
                    <p className="text-xs text-[var(--color-mute)]">
                      网站无法自动提取标签时，追加这些标签
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== 固定源模式 ===== */}
          {crawlMode === "source" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">爬取源</Label>
                  {loadingSources ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select value={selectedSource} onValueChange={(v) => v && setSelectedSource(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择爬取源" />
                      </SelectTrigger>
                      <SelectContent>
                        {sources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            <div className="flex items-center gap-2">
                              <Globe className="w-3 h-3" />
                              {source.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedSource && (
                    <p className="text-xs text-[var(--color-mute)]">
                      {sources.find((s) => s.id === selectedSource)?.description}
                    </p>
                  )}
                </div>

                {/* 模式选择 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">爬取模式</Label>
                  <Select
                    value={mode}
                    onValueChange={(v) => setMode(v as "random" | "sequential")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">
                        <div className="flex items-center gap-2">
                          <Shuffle className="w-3 h-3" />
                          随机爬取
                        </div>
                      </SelectItem>
                      <SelectItem value="sequential">
                        <div className="flex items-center gap-2">
                          <ListOrdered className="w-3 h-3" />
                          顺序爬取
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--color-mute)]">
                    {mode === "random" ? "随机获取热门壁纸" : "按最新时间顺序获取"}
                  </p>
                </div>

                {/* 数量输入 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">每页数量</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) =>
                      setCount(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 50))
                    }
                    placeholder="1-50"
                  />
                  <p className="text-xs text-[var(--color-mute)]">
                    建议 5-20 张，数量越多耗时越长
                  </p>
                </div>
              </div>

              {/* 分页 + 去重 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    连续爬取页数
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={pages}
                    onChange={(e) =>
                      setPages(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 10))
                    }
                    placeholder="1-10"
                  />
                  <p className="text-xs text-[var(--color-mute)]">
                    {pages > 1 ? `将连续爬取 ${pages} 页，预计最多 ${count * pages} 张` : "仅爬取当前页"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" />
                    去重处理
                  </Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={dedup}
                      onCheckedChange={setDedup}
                    />
                    <span className="text-sm">{dedup ? "开启" : "关闭"}</span>
                  </div>
                  <p className="text-xs text-[var(--color-mute)]">
                    {dedup ? "自动跳过已爬取的重复图片" : "不检查重复，可能导入相同图片"}
                  </p>
                </div>
              </div>

              {/* 手动分类和标签 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    手动分类（可选）
                  </Label>
                  <Select value={manualCategory || "__auto__"} onValueChange={(v) => setManualCategory(v === "__auto__" ? "" : (v ?? ""))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="自动识别 / 选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">自动识别</SelectItem>
                      <SelectItem value="自然风光">自然风光</SelectItem>
                      <SelectItem value="城市建筑">城市建筑</SelectItem>
                      <SelectItem value="人像摄影">人像摄影</SelectItem>
                      <SelectItem value="美食">美食</SelectItem>
                      <SelectItem value="旅行">旅行</SelectItem>
                      <SelectItem value="艺术">艺术</SelectItem>
                      <SelectItem value="动物">动物</SelectItem>
                      <SelectItem value="极简">极简</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--color-mute)]">
                    网站无法自动提取分类时，使用此分类
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    手动标签（可选）
                  </Label>
                  <Input
                    type="text"
                    value={manualTags}
                    onChange={(e) => setManualTags(e.target.value)}
                    placeholder="多个标签用逗号分隔，如：风景,山脉,日落"
                  />
                  <p className="text-xs text-[var(--color-mute)]">
                    网站无法自动提取标签时，追加这些标签
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 开始按钮 */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={startCrawl}
              disabled={status === "crawling" || (crawlMode === "source" && !selectedSource) || (crawlMode === "url" && !customUrl.trim())}
              className="gap-2"
            >
              {status === "crawling" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  爬取中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  开始爬取
                </>
              )}
            </Button>
            {status !== "idle" && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatus("idle");
                  setResults([]);
                  setProgressText("");
                  setErrorMessage("");
                }}
                disabled={status === "crawling"}
              >
                重置
              </Button>
            )}
          </div>

          {/* 进度/状态信息 */}
          {progressText && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-mute)]">
              <RefreshCw
                className={`w-3 h-3 ${status === "crawling" ? "animate-spin" : ""}`}
              />
              {progressText}
            </div>
          )}

          {/* 错误信息 */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errorMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 爬取结果预览 */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              本次爬取结果 ({results.length} 张)
            </CardTitle>
            <CardDescription>
              引用原始地址预览，点击下方"确认导入"按钮将数据保存到图库
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border overflow-hidden bg-muted/30 hover:shadow-md transition-shadow"
                >
                  {/* 缩略图/视频预览 */}
                  <div className="aspect-[4/3] relative">
                    {item.media_type === "video" && (item.original_video_url || item.video_url) ? (
                      <VideoPreview
                        videoUrl={item.original_video_url || item.video_url || ""}
                        posterUrl={item.poster_url || item.thumbnail_url || item.original_image_url || item.image_url || ""}
                      />
                    ) : item.thumbnail_url || item.image_url || item.url ? (
                      <img
                        src={item.thumbnail_url || item.image_url || item.url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // 图片加载失败时尝试显示占位
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const div = document.createElement('div');
                            div.className = 'w-full h-full flex items-center justify-center bg-muted';
                            div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                            parent.appendChild(div);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* 动态壁纸标识 */}
                    {item.media_type === "video" && (
                      <span className="absolute top-1 right-1 text-[9px] font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-1.5 py-0.5 rounded">
                        LIVE
                      </span>
                    )}
                  </div>
                  {/* 信息 */}
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {item.category && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {item.category}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {item.width}x{item.height}
                      </Badge>
                    </div>
                    {item.tags && (
                      <div className="flex items-center gap-0.5 flex-wrap">
                        <Tag className="w-2.5 h-2.5 text-muted-foreground" />
                        {item.tags.split(",").slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] text-muted-foreground"
                          >
                            {tag.trim()}
                            {idx < Math.min(item.tags.split(",").length, 3) - 1 ? "," : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* 悬停查看大图 */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                      <ExternalLink className="w-3 h-3 text-white" />
                    </div>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 爬取历史 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              爬取历史
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadHistory}
              disabled={loadingHistory}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingHistory ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
          <CardDescription>
            共 {historyTotal} 条爬取图片 | {crawlLogsTotal} 次爬取任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-16 h-12 rounded" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 && crawlLogs.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-mute)]">
              <Bug className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无爬取记录</p>
              <p className="text-xs">开始你的第一次爬取吧</p>
            </div>
          ) : (
            <>
              {/* 爬取任务日志 */}
              {crawlLogs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    爬取任务记录
                  </h4>
                  <div className="space-y-2">
                    {crawlLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 p-2 rounded-lg border text-sm"
                      >
                        {/* 状态标识 */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          log.status === "completed" ? "bg-green-500" :
                          log.status === "failed" ? "bg-red-500" :
                          "bg-yellow-500"
                        }`} />
                        {/* 任务信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{log.source}</span>
                            {log.category && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                {log.category}
                              </Badge>
                            )}
                            {log.tags && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-32">
                                {log.tags}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
                            <span className="text-green-600">{log.success_count}成功</span>
                            {log.fail_count > 0 && <span className="text-red-500">{log.fail_count}失败</span>}
                            {log.dedup_skipped > 0 && <span className="text-yellow-600">{log.dedup_skipped}跳过</span>}
                            {log.duration_seconds && <span>{log.duration_seconds}秒</span>}
                            <span>
                              {new Date(log.started_at).toLocaleDateString("zh-CN", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        {log.source_url && (
                          <a
                            href={log.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 爬取图片列表 */}
              {history.length > 0 && (
                <>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    已爬取图片
                  </h4>
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        {/* 缩略图 */}
                        <div className="w-16 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
                          {item.thumbnail_url ? (
                            <img
                              src={item.thumbnail_url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {/* 信息 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-mute)]">
                            {item.category && <span>{item.category}</span>}
                            <span>{item.width}x{item.height}</span>
                            {item.tags && (
                              <span className="truncate max-w-32">{item.tags.split(",").slice(0, 3).join(", ")}</span>
                            )}
                            <span>
                              {new Date(item.created_at).toLocaleDateString("zh-CN", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        {/* 查看按钮 */}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* 分页 */}
                  {historyTotal > 12 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-xs text-[var(--color-mute)]">
                        第 {historyPage} 页 / 共 {Math.ceil(historyTotal / 12)} 页
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        >
                          上一页
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={historyPage >= Math.ceil(historyTotal / 12)}
                          onClick={() => setHistoryPage((p) => p + 1)}
                        >
                          下一页
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}