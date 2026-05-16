"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Category {
  id: number;
  name: string;
  slug: string;
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
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="sticky top-16 z-40 bg-[var(--color-surface-soft)] py-4 border-b border-[var(--color-hairline-soft)]">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => onCategoryChange("all")}
            className={`relative flex-shrink-0 px-4 py-2 text-sm font-bold rounded-full transition-all ${
              activeCategory === "all"
                ? "bg-[var(--color-ink)] text-[var(--color-on-dark)]"
                : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
            }`}
          >
            全部
            {activeCategory === "all" && (
              <motion.div
                layoutId="activeChip"
                className="absolute inset-0 rounded-full bg-[var(--color-ink)] -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              onClick={() => onCategoryChange(category.slug)}
              className={`relative flex-shrink-0 px-4 py-2 text-sm font-bold rounded-full transition-all ${
                activeCategory === category.slug
                  ? "bg-[var(--color-ink)] text-[var(--color-on-dark)]"
                  : "bg-[var(--color-surface-card)] text-[var(--color-ink)] hover:bg-[var(--color-secondary-bg)]"
              }`}
            >
              {category.name}
              {activeCategory === category.slug && (
                <motion.div
                  layoutId="activeChip"
                  className="absolute inset-0 rounded-full bg-[var(--color-ink)] -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}