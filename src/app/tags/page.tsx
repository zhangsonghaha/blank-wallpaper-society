"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { Hash, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Tag {
  name: string;
  slug: string;
  count: number;
  size?: number;
}

export default function TagsPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tags?type=cloud")
      .then((res) => res.json())
      .then((data) => {
        setTags(data.data || []);
        setLoading(false);
      })
      .catch(() => {
        toast.error("获取标签失败");
        setLoading(false);
      });
  }, []);

  const sizeClasses: Record<number, string> = {
    1: "text-sm px-3 py-1.5",
    2: "text-base px-4 py-2",
    3: "text-lg px-5 py-2.5",
    4: "text-xl px-6 py-3",
    5: "text-2xl px-7 py-3.5",
  };

  const colorClasses = [
    "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
    "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
    "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
    "bg-pink-50 text-pink-700 hover:bg-pink-100 border-pink-200",
    "bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200",
    "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200",
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-surface-soft)]">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-purple-600 py-16 px-4">
        <div className="max-w-[960px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Hash className="w-12 h-12 text-white/80 mx-auto mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              标签云
            </h1>
            <p className="text-white/70 text-lg">
              通过标签发现更多精彩壁纸
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto px-4 py-8">
        {/* Popular Tags */}
        {tags.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                热门标签
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {tags.slice(0, 10).map((tag, i) => (
                <Link
                  key={tag.name}
                  href={`/?q=${encodeURIComponent(tag.name)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-primary-pressed)] transition-colors"
                >
                  <Hash className="w-3.5 h-3.5" />
                  {tag.name}
                  <span className="ml-1 text-white/70 text-xs">
                    {tag.count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Tag Cloud */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[var(--color-hairline)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-6 text-center">
            全部标签
          </h2>

          {loading ? (
            <div className="flex flex-wrap gap-3 justify-center">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-pulse rounded-full"
                  style={{
                    width: `${60 + Math.random() * 80}px`,
                    height: `${30 + Math.random() * 20}px`,
                  }}
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-wrap gap-3 justify-center items-center"
            >
              {tags.map((tag, i) => {
                const size = tag.size || 1;
                const colorIdx = i % colorClasses.length;

                return (
                  <motion.button
                    key={tag.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => {
                      setActiveTag(tag.name);
                      router.push(`/?q=${encodeURIComponent(tag.name)}`);
                    }}
                    onMouseEnter={() => setActiveTag(tag.name)}
                    onMouseLeave={() => setActiveTag(null)}
                    className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                      sizeClasses[size] || sizeClasses[1]
                    } ${colorClasses[colorIdx]} ${
                      activeTag === tag.name ? "ring-2 ring-offset-2 ring-[var(--color-primary)] scale-110" : ""
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    {tag.name}
                    <span className="opacity-60 text-xs ml-0.5">
                      {tag.count}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Browse by category */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-2">
              返回首页
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}