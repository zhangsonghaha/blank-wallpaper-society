"use client";

import { useState } from "react";
import {
  Book,
  Key,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap,
  Shield,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Link from "next/link";

// API端点定义
const endpoints = [
  {
    category: "壁纸",
    items: [
      {
        method: "GET",
        path: "/api/v1/wallpapers",
        summary: "获取壁纸列表",
        description: "分页获取壁纸列表，支持分类筛选、搜索和排序",
        params: [
          { name: "page", type: "integer", required: false, description: "页码，默认1" },
          { name: "limit", type: "integer", required: false, description: "每页数量，默认24，最大100" },
          { name: "category", type: "string", required: false, description: "分类筛选" },
          { name: "search", type: "string", required: false, description: "搜索关键词" },
          { name: "sort", type: "string", required: false, description: "排序方式：newest/popular/downloads" },
        ],
        response: {
          success: true,
          data: [
            {
              id: 1,
              title: "山间晨雾",
              description: "清晨山间的美丽雾景",
              url: "https://example.com/image.jpg",
              thumbnail_url: "https://example.com/thumb.jpg",
              width: 3840,
              height: 2160,
              tags: ["风景", "山脉"],
              category: "nature",
              view_count: 1234,
              download_count: 567,
            },
          ],
          pagination: { total: 100, page: 1, limit: 24, totalPages: 5 },
        },
      },
      {
        method: "GET",
        path: "/api/v1/wallpapers/{id}",
        summary: "获取壁纸详情",
        description: "根据ID获取单张壁纸的详细信息",
        params: [
          { name: "id", type: "integer", required: true, description: "壁纸ID" },
        ],
        response: {
          success: true,
          data: {
            id: 1,
            title: "山间晨雾",
            width: 3840,
            height: 2160,
            file_size: 5242880,
            mime_type: "image/jpeg",
            dominant_color: "#4a90d9",
            color_palette: ["#4a90d9", "#2d5a8c", "#8bc1f0"],
          },
        },
      },
      {
        method: "GET",
        path: "/api/v1/wallpapers/{id}/download",
        summary: "获取下载链接",
        description: "获取壁纸的下载URL，支持指定分辨率",
        params: [
          { name: "id", type: "integer", required: true, description: "壁纸ID" },
          { name: "resolution", type: "string", required: false, description: "分辨率，如1920x1080" },
        ],
        response: {
          success: true,
          data: {
            id: 1,
            title: "山间晨雾",
            download_url: "https://example.com/api/images/1/download",
            available_resolutions: ["1920x1080", "2560x1440", "3840x2160"],
          },
        },
      },
    ],
  },
  {
    category: "分类",
    items: [
      {
        method: "GET",
        path: "/api/v1/categories",
        summary: "获取分类列表",
        description: "获取所有壁纸分类",
        params: [],
        response: {
          success: true,
          data: [
            { id: 1, name: "自然", slug: "nature", sort_order: 1 },
            { id: 2, name: "城市", slug: "city", sort_order: 2 },
          ],
        },
      },
    ],
  },
  {
    category: "合集",
    items: [
      {
        method: "GET",
        path: "/api/v1/collections",
        summary: "获取合集列表",
        description: "分页获取公开合集列表",
        params: [
          { name: "page", type: "integer", required: false, description: "页码" },
          { name: "limit", type: "integer", required: false, description: "每页数量，最大50" },
          { name: "featured", type: "boolean", required: false, description: "是否按热度排序" },
        ],
        response: {
          success: true,
          data: [
            {
              id: 1,
              title: "精选自然风光",
              image_count: 24,
              subscriber_count: 156,
              author: { name: "摄影师A" },
            },
          ],
          pagination: { total: 50, page: 1, limit: 12, totalPages: 5 },
        },
      },
    ],
  },
  {
    category: "排行榜",
    items: [
      {
        method: "GET",
        path: "/api/v1/rankings",
        summary: "获取排行榜",
        description: "获取下载/浏览/收藏排行榜",
        params: [
          { name: "type", type: "string", required: false, description: "类型：downloads/views/favorites" },
          { name: "period", type: "string", required: false, description: "周期：daily/weekly/monthly/all" },
          { name: "limit", type: "integer", required: false, description: "数量，最大100" },
        ],
        response: {
          success: true,
          data: [
            { rank: 1, id: 1, title: "热门壁纸", download_count: 9999 },
          ],
          meta: { period: "weekly", type: "downloads" },
        },
      },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PUT: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
  PATCH: "bg-purple-100 text-purple-700",
};

export default function ApiDocsPage() {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [testEndpoint, setTestEndpoint] = useState("/api/v1/wallpapers");
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const toggleEndpoint = (path: string) => {
    setExpandedEndpoint(expandedEndpoint === path ? null : path);
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-API-Key"] = apiKey;
      }
      const res = await fetch(testEndpoint, { headers });
      const data = await res.json();
      setTestResult({
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: data,
      });
    } catch (err: any) {
      setTestResult({ error: err.message });
    }
    setTestLoading(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-soft)]">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-purple-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
          <div className="flex items-center gap-3 mb-4">
            <Book className="w-8 h-8" />
            <Badge className="bg-white/20 text-white border-none rounded-full">
              v1
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            API 文档
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl">
            通过 RESTful API 集成壁纸数据到您的应用中。支持 API Key 认证和匿名访问。
          </p>
          <div className="flex gap-3 mt-8">
            <Link href="/profile">
              <Button className="rounded-full bg-white text-[var(--color-primary)] hover:bg-white/90 gap-2">
                <Key className="w-4 h-4" />
                获取 API Key
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full border-white/30 text-white hover:bg-white/10"
              onClick={() => document.getElementById("try-it")?.scrollIntoView({ behavior: "smooth" })}
            >
              在线测试
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-[var(--color-ink)] mb-2">RESTful API</h3>
              <p className="text-sm text-[var(--color-mute)]">
                标准 REST 接口，JSON 响应格式，支持分页、搜索、排序
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-[var(--color-ink)] mb-2">API Key 认证</h3>
              <p className="text-sm text-[var(--color-mute)]">
                通过 API Key 认证获取更高请求配额，每日最高 1000 次
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-none shadow-sm">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-[var(--color-ink)] mb-2">智能限流</h3>
              <p className="text-sm text-[var(--color-mute)]">
                匿名每日100次，API Key 每日1000次，响应头实时反馈用量
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Authentication */}
        <Card className="rounded-xl border-none shadow-sm mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[var(--color-primary)]" />
              认证方式
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="apikey">
              <TabsList variant="line">
                <TabsTrigger value="apikey">API Key 认证</TabsTrigger>
                <TabsTrigger value="anonymous">匿名访问</TabsTrigger>
              </TabsList>
              <TabsContent value="apikey">
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-[var(--color-mute)]">
                    在请求头中添加 <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">X-API-Key</code> 或在查询参数中添加 <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">api_key</code>：
                  </p>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm relative">
                    <button
                      onClick={() => copyToClipboard(
                        `curl -H "X-API-Key: your_api_key" https://api.example.com/api/v1/wallpapers`,
                        "auth-curl"
                      )}
                      className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/10"
                    >
                      {copied === "auth-curl" ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <p className="text-gray-500"># 请求头方式</p>
                    <p>curl -H "X-API-Key: your_api_key" \</p>
                    <p className="pl-4">https://api.example.com/api/v1/wallpapers</p>
                    <p className="text-gray-500 mt-3"># 查询参数方式</p>
                    <p>curl https://api.example.com/api/v1/wallpapers?api_key=your_api_key</p>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                    <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-700">
                      API Key 使用 SHA256 哈希存储，创建后仅显示一次完整 Key，请妥善保存。
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="anonymous">
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-[var(--color-mute)]">
                    无需 API Key 即可访问 API，但每日请求限制为 100 次（基于 IP）。
                  </p>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm">
                    <p className="text-gray-500"># 匿名请求</p>
                    <p>curl https://api.example.com/api/v1/wallpapers</p>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                    <BarChart3 className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      匿名请求达到限制后，将返回 429 状态码。建议使用 API Key 获取更高配额。
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Rate Limit */}
        <Card className="rounded-xl border-none shadow-sm mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
              限流说明
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-mute)]">认证方式</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-mute)]">每日限额</th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-mute)]">说明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4">匿名 (IP)</td>
                    <td className="py-3 px-4"><Badge variant="secondary" className="rounded-full">100 次/天</Badge></td>
                    <td className="py-3 px-4 text-[var(--color-mute)]">基于 IP 地址计数</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">API Key</td>
                    <td className="py-3 px-4"><Badge className="rounded-full bg-emerald-100 text-emerald-700">1000 次/天</Badge></td>
                    <td className="py-3 px-4 text-[var(--color-mute)]">可在个人设置中调整（1-100000）</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-2">
              <h4 className="font-medium text-sm">响应头</h4>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs space-y-1">
                <p><span className="text-emerald-600">X-RateLimit-Limit:</span> 1000</p>
                <p><span className="text-emerald-600">X-RateLimit-Remaining:</span> 999</p>
                <p><span className="text-emerald-600">X-RateLimit-Reset:</span> 86400</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6">API 端点</h2>
        <div className="space-y-4 mb-16">
          {endpoints.map((group) => (
            <Card key={group.category} className="rounded-xl border-none shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{group.category}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {group.items.map((ep, idx) => (
                  <div key={ep.path}>
                    {idx > 0 && <Separator />}
                    <button
                      className="w-full px-6 py-4 flex items-center gap-3 hover:bg-gray-50/50 transition-colors text-left"
                      onClick={() => toggleEndpoint(`${group.category}-${ep.path}`)}
                    >
                      <Badge className={`${methodColors[ep.method]} rounded text-xs font-mono px-2 py-0.5`}>
                        {ep.method}
                      </Badge>
                      <span className="font-mono text-sm text-[var(--color-ink)]">{ep.path}</span>
                      <span className="text-sm text-[var(--color-mute)] ml-2">{ep.summary}</span>
                      <span className="ml-auto">
                        {expandedEndpoint === `${group.category}-${ep.path}` ? (
                          <ChevronDown className="w-4 h-4 text-[var(--color-mute)]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-[var(--color-mute)]" />
                        )}
                      </span>
                    </button>

                    {expandedEndpoint === `${group.category}-${ep.path}` && (
                      <div className="px-6 pb-6 space-y-4">
                        <p className="text-sm text-[var(--color-mute)]">{ep.description}</p>

                        {/* Parameters */}
                        {ep.params.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2">参数</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2 px-3 font-medium text-[var(--color-mute)]">名称</th>
                                    <th className="text-left py-2 px-3 font-medium text-[var(--color-mute)]">类型</th>
                                    <th className="text-left py-2 px-3 font-medium text-[var(--color-mute)]">必填</th>
                                    <th className="text-left py-2 px-3 font-medium text-[var(--color-mute)]">说明</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ep.params.map((p) => (
                                    <tr key={p.name} className="border-b last:border-0">
                                      <td className="py-2 px-3 font-mono text-xs">{p.name}</td>
                                      <td className="py-2 px-3 text-xs text-[var(--color-mute)]">{p.type}</td>
                                      <td className="py-2 px-3">
                                        {p.required ? (
                                          <Badge className="rounded text-[10px] bg-red-100 text-red-700">必填</Badge>
                                        ) : (
                                          <Badge variant="secondary" className="rounded text-[10px]">可选</Badge>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-xs text-[var(--color-mute)]">{p.description}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Response Example */}
                        <div>
                          <h4 className="font-medium text-sm mb-2">响应示例</h4>
                          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto relative">
                            <button
                              onClick={() => copyToClipboard(JSON.stringify(ep.response, null, 2), `res-${ep.path}`)}
                              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/10"
                            >
                              {copied === `res-${ep.path}` ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            <pre>{JSON.stringify(ep.response, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Try It Out */}
        <div id="try-it">
          <Card className="rounded-xl border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-[var(--color-primary)]" />
                在线测试
              </CardTitle>
              <CardDescription>直接在浏览器中测试 API 端点</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">API 端点</label>
                    <Input
                      value={testEndpoint}
                      onChange={(e) => setTestEndpoint(e.target.value)}
                      placeholder="/api/v1/wallpapers"
                      className="font-mono rounded-xl"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">
                      API Key <span className="text-[var(--color-mute)] font-normal">(可选)</span>
                    </label>
                    <Input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="bws_xxxxxxxx"
                      className="font-mono rounded-xl"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleTest}
                      disabled={testLoading}
                      className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-2 px-6"
                    >
                      {testLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      发送请求
                    </Button>
                  </div>
                </div>

                {testResult && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`rounded-full ${
                          testResult.status < 300
                            ? "bg-emerald-100 text-emerald-700"
                            : testResult.status < 500
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {testResult.status || "Error"}
                      </Badge>
                      {testResult.headers?.["x-ratelimit-limit"] && (
                        <span className="text-xs text-[var(--color-mute)]">
                          限流: {testResult.headers["x-ratelimit-remaining"]}/{testResult.headers["x-ratelimit-limit"]}
                        </span>
                      )}
                    </div>
                    <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                      <pre>
                        {testResult.error
                          ? `Error: ${testResult.error}`
                          : JSON.stringify(testResult.body, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center py-12">
          <p className="text-sm text-[var(--color-mute)]">
            需要 API Key？前往{" "}
            <Link href="/profile" className="text-[var(--color-primary)] hover:underline">
              个人主页
            </Link>{" "}
            创建
          </p>
        </div>
      </div>
    </div>
  );
}