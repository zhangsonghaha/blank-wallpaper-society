"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import type { VariantStatus } from "./types";

export function useVariants() {
  const [variantGenerating, setVariantGenerating] = useState(false);
  const [variantStatus, setVariantStatus] = useState<VariantStatus | null>(null);

  const loadVariantStatus = async () => {
    try {
      const res = await fetch("/api/admin/generate-variants");
      if (res.ok) {
        const data = await res.json();
        setVariantStatus(data);
      }
    } catch (err) {
      console.error("加载变体状态失败:", err);
    }
  };

  useEffect(() => {
    loadVariantStatus();
  }, []);

  const handleGenerateVariants = async () => {
    setVariantGenerating(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/generate-variants?limit=50", {
        method: "POST",
        headers: { ...csrfHeaders },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("变体生成完成", {
          description: data.message,
          duration: 5000,
        });
        loadVariantStatus();
      } else {
        toast.error("变体生成失败", { description: data.error });
      }
    } catch (err) {
      toast.error("变体生成失败", { description: "网络错误" });
    }
    setVariantGenerating(false);
  };

  return {
    variantGenerating,
    variantStatus,
    loadVariantStatus,
    handleGenerateVariants,
  };
}
