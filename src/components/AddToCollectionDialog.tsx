"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  FolderPlus,
  Check,
  Grid3X3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import CollectionDialog from "./CollectionDialog";

interface Collection {
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  cover_thumbnail_url: string | null;
  image_count: number;
}

interface AddToCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageId: number | null;
}

export default function AddToCollectionDialog({
  open,
  onOpenChange,
  imageId,
}: AddToCollectionDialogProps) {
  const { data: session } = useSession();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // 加载用户的合集
  useEffect(() => {
    if (open && session) {
      setLoading(true);
      const userId = (session.user as any).id;
      fetch(`/api/collections?userId=${userId}&limit=50`)
        .then((res) => res.json())
        .then((data) => {
          setCollections(data.data || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, session]);

  const handleAddToCollection = async (collectionId: number) => {
    if (!imageId) return;
    setAddingTo(collectionId);
    try {
      const res = await fetch(`/api/collections/${collectionId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (res.ok) {
        toast.success("已添加到合集");
        setAddedIds((prev) => new Set(prev).add(collectionId));
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId ? { ...c, image_count: c.image_count + 1 } : c
          )
        );
      } else {
        const data = await res.json();
        if (data.error === "图片已在合集中") {
          toast.info("图片已在合集中");
          setAddedIds((prev) => new Set(prev).add(collectionId));
        } else {
          toast.error(data.error || "添加失败");
        }
      }
    } catch {
      toast.error("添加失败");
    }
    setAddingTo(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl max-w-md max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-[var(--color-primary)]" />
              加入合集
            </DialogTitle>
            <DialogDescription>
              选择一个合集来添加这张图片
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
              <span className="ml-2 text-sm text-[var(--color-mute)]">加载中...</span>
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <Grid3X3 className="w-12 h-12 text-[var(--color-ash)] mx-auto mb-3" />
              <p className="text-sm text-[var(--color-mute)] mb-4">
                还没有合集，先创建一个吧
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-pressed)] gap-2"
              >
                <Plus className="w-4 h-4" />
                创建合集
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {collections.map((collection) => {
                const isAdded = addedIds.has(collection.id);
                const isAdding = addingTo === collection.id;

                return (
                  <motion.div
                    key={collection.id}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-soft)] transition-colors cursor-pointer"
                    onClick={() => !isAdded && handleAddToCollection(collection.id)}
                  >
                    {/* Mini Cover */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--color-surface-card)] shrink-0">
                      {collection.cover_thumbnail_url || collection.cover_url ? (
                        <img
                          src={collection.cover_thumbnail_url || collection.cover_url || ""}
                          alt={collection.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Grid3X3 className="w-5 h-5 text-[var(--color-ash)]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                        {collection.title}
                      </p>
                      <p className="text-xs text-[var(--color-mute)]">
                        {collection.image_count} 张图片
                      </p>
                    </div>

                    {/* Action */}
                    {isAdding ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)] shrink-0" />
                    ) : isAdded ? (
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--color-surface-card)] flex items-center justify-center shrink-0 hover:bg-[var(--color-primary)] hover:text-white transition-colors group">
                        <Plus className="w-4 h-4 text-[var(--color-mute)] group-hover:text-white" />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Create New */}
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--color-hairline)] hover:bg-[var(--color-surface-soft)] transition-colors"
              >
                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[var(--color-primary)]/10 shrink-0">
                  <Plus className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-primary)]">
                  创建新合集
                </span>
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Collection Dialog */}
      <CollectionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          // 重新加载合集列表
          if (session) {
            const userId = (session.user as any).id;
            fetch(`/api/collections?userId=${userId}&limit=50`)
              .then((res) => res.json())
              .then((data) => setCollections(data.data || []));
          }
        }}
      />
    </>
  );
}