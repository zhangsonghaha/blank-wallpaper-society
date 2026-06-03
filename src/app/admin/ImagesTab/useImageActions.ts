"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";
import type { ImageRecord, UploadForm, EditForm } from "./types";

const EMPTY_UPLOAD_FORM: UploadForm = {
  file: null, url: "", title: "", description: "", author: "", tags: "", category: "",
};

export function useImageActions(onReload: () => void) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [uploadForm, setUploadForm] = useState<UploadForm>({ ...EMPTY_UPLOAD_FORM });
  const [previewUrl, setPreviewUrl] = useState("");

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    id: 0, title: "", description: "", author: "", tags: "", category: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Detail dialog
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (images: ImageRecord[]) => {
    if (selectedIds.size === images.length && images.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map(img => img.id)));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm((prev) => ({ ...prev, file }));
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUrlPreview = useCallback(async () => {
    if (!uploadForm.url) return;
    setPreviewUrl(uploadForm.url);
  }, [uploadForm.url]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let res;
      if (uploadMode === "url") {
        if (!uploadForm.url) { toast.error("请输入图片链接"); setUploading(false); return; }
        res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadForm),
        });
      } else {
        if (!uploadForm.file) { toast.error("请选择文件"); setUploading(false); return; }
        const fd = new FormData();
        fd.append("file", uploadForm.file);
        fd.append("title", uploadForm.title);
        fd.append("description", uploadForm.description);
        fd.append("author", uploadForm.author);
        fd.append("tags", uploadForm.tags);
        fd.append("category", uploadForm.category);
        res = await fetch("/api/upload", { method: "POST", body: fd });
      }

      const result = await res.json();
      if (res.ok) {
        toast.success("上传成功", { description: result.message });
        setUploadOpen(false);
        setUploadForm({ ...EMPTY_UPLOAD_FORM });
        setPreviewUrl("");
        onReload();
      } else if (res.status === 409) {
        const dup = result.duplicate;
        toast.error("检测到重复图片", {
          description: `与「${dup?.title || "ID:" + dup?.id}」相似度超过95%，已阻止上传`,
          duration: 5000,
        });
      } else {
        toast.error("上传失败", { description: result.error });
      }
    } catch {
      toast.error("上传失败", { description: "网络错误" });
    }
    setUploading(false);
  };

  const handleDelete = async (image: ImageRecord) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/images/${image.id}`, { method: "DELETE", headers: { ...csrfHeaders } });
      if (res.ok) {
        toast.success("已删除", { description: `"${image.title}" 已删除` });
        onReload();
        setDetailOpen(false);
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch("/api/images/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("批量删除成功", { description: data.message });
        setSelectedIds(new Set());
        setBatchDeleteConfirmOpen(false);
        onReload();
      } else {
        toast.error("批量删除失败", { description: data.error });
      }
    } catch {
      toast.error("批量删除失败", { description: "网络错误" });
    }
    setBatchDeleting(false);
  };

  const toggleFavorite = async (image: ImageRecord) => {
    try {
      const csrfHeaders = await withCsrfHeader();
      if (image.is_favorite) {
        await fetch(`/api/favorites/${image.id}`, { method: "DELETE", headers: { ...csrfHeaders } });
      } else {
        await fetch(`/api/favorites/${image.id}`, { method: "POST", headers: { ...csrfHeaders } });
      }
      onReload();
    } catch (err) {
      console.error("切换收藏失败:", err);
    }
  };

  const openEdit = (image: ImageRecord) => {
    setEditForm({
      id: image.id,
      title: image.title,
      description: image.description,
      author: image.author,
      tags: image.tags,
      category: image.category,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editForm.title.trim()) { toast.error("标题不能为空"); return; }
    setEditSaving(true);
    try {
      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(`/api/images/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          author: editForm.author,
          tags: editForm.tags,
          category: editForm.category,
        }),
      });
      if (res.ok) {
        toast.success("更新成功");
        setEditOpen(false);
        setDetailOpen(false);
        onReload();
      } else {
        const data = await res.json();
        toast.error("更新失败", { description: data.error });
      }
    } catch {
      toast.error("更新失败", { description: "网络错误" });
    }
    setEditSaving(false);
  };

  return {
    selectedIds, setSelectedIds,
    batchDeleteConfirmOpen, setBatchDeleteConfirmOpen,
    batchDeleting,
    uploadOpen, setUploadOpen,
    uploading, uploadMode, setUploadMode,
    uploadForm, setUploadForm,
    previewUrl, setPreviewUrl,
    editOpen, setEditOpen,
    editForm, setEditForm,
    editSaving,
    selectedImage, setSelectedImage,
    detailOpen, setDetailOpen,
    toggleSelect, toggleSelectAll,
    handleFileSelect, handleUrlPreview, handleUpload,
    handleDelete, handleBatchDelete,
    toggleFavorite,
    openEdit, handleEditSave,
  };
}
