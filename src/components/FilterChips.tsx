"use client";

import { useState, useEffect } from "react";

interface Category {
  id: number;
  name: string;
  slug: string;
  image_count?: number;
}

interface FilterChipsProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function FilterChips({ activeCategory, onCategoryChange }: FilterChipsProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        const allCategories = Array.isArray(data) ? data : [];
        // 只显示有图片的分类，但保留当前激活的分类（即使没有图片）
        setCategories(allCategories);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="sticky top-16 z-40 bg-[var(--color-surface-soft)] py-4 border-b border-[var(--color-hairline-soft)]">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => onCategoryChange("all")}
            className="relative flex-shrink-0 px-4 py-2 text-sm font-bold rounded-full transition-all duration-200"
            style={
              activeCategory === "all"
                ? { backgroundColor: "var(--color-ink)", color: "var(--color-on-dark)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }
                : { backgroundColor: "var(--color-surface-card)", color: "var(--color-ink)" }
            }
          >
            全部
          </button>
          {categories
            .filter((category) => (category.image_count ?? 0) > 0 || activeCategory === category.slug)
            .map((category) => (
              <button
                key={category.slug}
                onClick={() => onCategoryChange(category.slug)}
                className="relative flex-shrink-0 px-4 py-2 text-sm font-bold rounded-full transition-all duration-200 hover:opacity-90"
                style={
                  activeCategory === category.slug
                    ? { backgroundColor: "var(--color-ink)", color: "var(--color-on-dark)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }
                    : { backgroundColor: "var(--color-surface-card)", color: "var(--color-ink)" }
                }
              >
                {category.name}
                {(category.image_count ?? 0) > 0 && (
                  <span className="ml-1 text-xs opacity-60">({category.image_count})</span>
                )}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}