"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image as ImageIcon,
  Video,
  Link2,
  X,
  Send,
  ChevronDown,
  Loader2,
  Globe,
  Users,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { withCsrfHeader } from "@/lib/csrf-client";

interface PostEditorProps {
  onPostCreated?: (post: any) => void;
  editPost?: any;
  onCancelEdit?: () => void;
}

const VISIBILITY_OPTIONS = [
  { id: "public", label: "公开", icon: Globe },
  { id: "followers", label: "仅关注者", icon: Users },
  { id: "private", label: "仅自己", icon: Lock },
];

export default function PostEditor({ onPostCreated, editPost, onCancelEdit }: PostEditorProps) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState(editPost?.content || "");
  const [visibility, setVisibility] = useState(editPost?.visibility || "public");
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(!!editPost?.link_previews?.length);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = !!editPost;
  const isLoggedIn = status === "authenticated";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxFiles = 9;
    const newFiles = [...files, ...selectedFiles].slice(0, maxFiles);

    setFiles(newFiles);

    // 生成预览
    const newPreviews: string[] = [];
    newFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      newPreviews.push(url);
    });
    setFilePreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const extractLinkFromContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    autoResizeTextarea();

    // 自动检测链接
    const detectedLink = extractLinkFromContent(value);
    if (detectedLink && !showLinkInput) {
      setLinkUrl(detectedLink);
      setShowLinkInput(true);
    }
  };

  const handleSubmit = async () => {
    if (!isLoggedIn) {
      toast.error("请先登录");
      return;
    }

    if (!content.trim() && files.length === 0 && !linkUrl.trim()) {
      toast.error("动态内容不能为空");
      return;
    }

    if (content.length > 2000) {
      toast.error("动态内容不能超过2000字");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("visibility", visibility);

      if (linkUrl.trim()) {
        formData.append("link_url", linkUrl.trim());
        if (linkTitle.trim()) formData.append("link_title", linkTitle.trim());
      }

      files.forEach((file) => {
        formData.append("files", file);
      });

      const url = isEditing ? `/api/posts/${editPost.id}` : "/api/posts";
      const method = isEditing ? "PUT" : "POST";

      const csrfHeaders = await withCsrfHeader();
      const res = await fetch(url, { method, body: formData, headers: { ...csrfHeaders } });
      const data = await res.json();

      if (res.ok) {
        toast.success(isEditing ? "更新成功" : "发布成功");
        setContent("");
        setFiles([]);
        setFilePreviews([]);
        setLinkUrl("");
        setLinkTitle("");
        setShowLinkInput(false);
        setVisibility("public");
        onPostCreated?.(data.post);
        if (isEditing && onCancelEdit) onCancelEdit();
      } else {
        toast.error(data.error || "操作失败");
      }
    } catch (err) {
      console.error("发布动态失败:", err);
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) return null;

  const currentVisibility = VISIBILITY_OPTIONS.find((v) => v.id === visibility)!;
  const VisibilityIcon = currentVisibility.icon;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-hairline)] shadow-sm overflow-hidden">
      {/* 编辑模式标题 */}
      {isEditing && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface-card)] border-b border-[var(--color-hairline)]">
          <span className="text-sm font-semibold text-[var(--color-ink)]">编辑动态</span>
          <button
            onClick={onCancelEdit}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-secondary-bg)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--color-mute)]" />
          </button>
        </div>
      )}

      <div className="p-4">
        {/* 用户信息 + 输入区域 */}
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0 overflow-hidden">
            {session?.user?.image ? (
              <img src={session.user.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-sm font-medium">
                {session?.user?.name?.[0] || "?"}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="分享你的想法..."
              rows={2}
              className="w-full resize-none border-0 outline-none text-[var(--color-ink)] placeholder:text-[var(--color-ash)] text-sm leading-relaxed bg-transparent"
              style={{ maxHeight: 200 }}
            />

            {/* 文件预览 */}
            <AnimatePresence>
              {filePreviews.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 grid grid-cols-3 gap-2"
                >
                  {filePreviews.map((preview, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-surface-card)]"
                    >
                      {files[idx]?.type.startsWith("video/") ? (
                        <video
                          src={preview}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={preview}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 链接输入 */}
            <AnimatePresence>
              {showLinkInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-card)]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-4 h-4 text-[var(--color-mute)]" />
                    <span className="text-xs font-semibold text-[var(--color-mute)]">链接</span>
                    <button
                      onClick={() => {
                        setShowLinkInput(false);
                        setLinkUrl("");
                        setLinkTitle("");
                      }}
                      className="ml-auto"
                    >
                      <X className="w-4 h-4 text-[var(--color-ash)] hover:text-[var(--color-ink)]" />
                    </button>
                  </div>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-sm border-0 outline-none bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-ash)]"
                  />
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="链接标题（可选）"
                    className="w-full text-sm border-0 outline-none bg-transparent text-[var(--color-ink)] placeholder:text-[var(--color-ash)] mt-2"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-hairline-soft)]">
        <div className="flex items-center gap-1">
          {/* 添加图片 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
            title="添加图片/视频"
          >
            <ImageIcon className="w-4 h-4 text-[var(--color-mute)]" />
          </button>

          {/* 添加视频 - 同一个文件选择器 */}
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*,video/*";
                fileInputRef.current.click();
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
            title="添加视频"
          >
            <Video className="w-4 h-4 text-[var(--color-mute)]" />
          </button>

          {/* 添加链接 */}
          <button
            onClick={() => setShowLinkInput(!showLinkInput)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              showLinkInput ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-surface-card)]"
            }`}
            title="插入链接"
          >
            <Link2 className="w-4 h-4" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* 可见范围 */}
          <div className="relative ml-2">
            <button
              onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-mute)] rounded-full hover:bg-[var(--color-surface-card)] transition-colors"
            >
              <VisibilityIcon className="w-3 h-3" />
              <span>{currentVisibility.label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
              {showVisibilityMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute bottom-full left-0 mb-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-hairline)] overflow-hidden z-10"
                >
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setVisibility(opt.id);
                          setShowVisibilityMenu(false);
                        }}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-[var(--color-surface-card)] transition-colors whitespace-nowrap ${
                          visibility === opt.id ? "text-[var(--color-primary)] font-semibold" : "text-[var(--color-ink)]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 字数统计 + 发布按钮 */}
        <div className="flex items-center gap-3">
          <span className={`text-xs ${content.length > 1800 ? "text-[var(--color-error)]" : "text-[var(--color-ash)]"}`}>
            {content.length}/2000
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting || (!content.trim() && files.length === 0 && !linkUrl.trim())}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold rounded-full transition-all ${
              submitting || (!content.trim() && files.length === 0 && !linkUrl.trim())
                ? "bg-[var(--color-surface-card)] text-[var(--color-ash)] cursor-not-allowed"
                : "bg-[var(--color-primary)] text-white hover:opacity-90 active:scale-95"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isEditing ? "更新" : "发布"}
          </button>
        </div>
      </div>
    </div>
  );
}