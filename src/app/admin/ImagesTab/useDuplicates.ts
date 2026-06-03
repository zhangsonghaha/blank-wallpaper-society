"use client";

import { useState } from "react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";

export function useDuplicates(onReload: () => void) {
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateDeleteIds, setDuplicateDeleteIds] = useState<Set<number>>(new Set());
  const [duplicateDeleting, setDuplicateDeleting] = useState(false);

  const loadDuplicates = async () => {
    setDuplicateLoading(true);
    try {
      const res = await fetch("/api/admin/duplicates");
      if (res.ok) {
        const data = await res.json();
        setDuplicateGroups(data.groups || []);
      } else {
        const data = await res.json();
        toast.error("加载重复检测失败", { description: data.error });
      }
    } catch {
      toast.error("加载重复检测失败", { description: "网络错误" });
    }
    setDuplicateLoading(false);
  };

  const toggleDuplicateSelect = (id: number) => {
    setDuplicateDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDuplicateDelete = async () => {
    if (duplicateDeleteIds.size === 0) return;
    setDuplicateDeleting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/admin/duplicates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ids: Array.from(duplicateDeleteIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("删除成功", { description: data.message });
        setDuplicateDeleteIds(new Set());
        loadDuplicates();
        onReload();
      } else {
        toast.error("删除失败", { description: data.error });
      }
    } catch {
      toast.error("删除失败", { description: "网络错误" });
    }
    setDuplicateDeleting(false);
  };

  return {
    duplicateGroups,
    duplicateLoading,
    duplicateDeleteIds, setDuplicateDeleteIds,
    duplicateDeleting,
    loadDuplicates,
    toggleDuplicateSelect,
    handleDuplicateDelete,
  };
}
