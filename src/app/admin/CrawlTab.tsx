"use client";

import { useState, useEffect, useCallback } from "react";
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

type CrawlStatus = "idle" | "crawling" | "processing" | "done" | "error";

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
  const [status, setStatus] = useState<CrawlStatus>("idle");
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<CrawlResult[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
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
      const res = await fetch("/api/admin/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          crawlMode === "url"
            ? {
                url: customUrl.trim(),
                fetchMode,
                count,
                minWidth,
              }
            : {
                source: selectedSource,
                mode,
                count,
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
      setResults(data.results || []);
      toast.success(data.message || `爬取完成，成功 ${data.successCount} 张`);
      setProgressText(
        `成功: ${data.successCount} 张 | 失败: ${data.failCount} 张`
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
                    <Label className="text-sm font-medium">爬取数量</Label>
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
              </div>
            </div>
          )}

          {/* ===== 固定源模式 ===== */}
          {crawlMode === "source" && (
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
                <Label className="text-sm font-medium">爬取数量</Label>
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
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {results.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border overflow-hidden bg-muted/30 hover:shadow-md transition-shadow"
                >
                  {/* 缩略图 */}
                  <div className="aspect-[4/3] relative">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
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
            共 {historyTotal} 条爬取记录
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
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-mute)]">
              <Bug className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无爬取记录</p>
              <p className="text-xs">开始你的第一次爬取吧</p>
            </div>
          ) : (
            <>
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
        </CardContent>
      </Card>
    </div>
  );
}