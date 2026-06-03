"use client";

import { useState, useEffect, useCallback } from "react";
import type { ImageRecord, Category, ImageStats } from "./types";

export function useImagesList() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [jumpPage, setJumpPage] = useState("");

  const [stats, setStats] = useState<ImageStats>({
    totalImages: 0,
    totalViews: 0,
    totalFavorites: 0,
    totalCategories: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const [imagesRes, categoriesRes] = await Promise.all([
        fetch(`/api/images?${params}&showAll=true`),
        fetch("/api/categories"),
      ]);

      const imagesData = await imagesRes.json();
      const categoriesData = await categoriesRes.json();

      setImages(imagesData.data || []);
      setTotal(imagesData.total || 0);
      setTotalPages(imagesData.totalPages || 1);
      setCategories(categoriesData || []);

      setStats({
        totalImages: imagesData.total || 0,
        totalViews: (imagesData.data || []).reduce(
          (sum: number, img: ImageRecord) => sum + (img.view_count || 0), 0
        ),
        totalFavorites: (imagesData.data || []).filter(
          (img: ImageRecord) => img.is_favorite
        ).length,
        totalCategories: categoriesData.length || 0,
      });
    } catch (err) {
      console.error("加载失败:", err);
    }
    setLoading(false);
  }, [page, searchQuery, categoryFilter, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    images,
    categories,
    loading,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    page,
    setPage,
    totalPages,
    total,
    pageSize,
    setPageSize,
    jumpPage,
    setJumpPage,
    stats,
    loadData,
  };
}
