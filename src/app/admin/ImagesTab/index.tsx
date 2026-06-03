"use client";

import { useState } from "react";
import { Toaster, toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useImagesList } from "./useImagesList";
import { useImageActions } from "./useImageActions";
import { useDuplicates } from "./useDuplicates";
import { useVariants } from "./useVariants";
import { usePaidWallpaper } from "./usePaidWallpaper";
import StatsCards from "./StatsCards";
import ImageListToolbar from "./ImageListToolbar";
import ImageTable from "./ImageTable";
import DuplicatesPanel from "./DuplicatesPanel";
import ImageUploadDialog from "./ImageUploadDialog";
import ImageDetailDialog from "./ImageDetailDialog";
import ImageEditDialog from "./ImageEditDialog";
import PaidDialog from "./PaidDialog";

export default function ImagesTab() {
  const [activeTab, setActiveTab] = useState<"list" | "duplicates">("list");

  // Hooks
  const list = useImagesList();
  const actions = useImageActions(list.loadData);
  const duplicates = useDuplicates(list.loadData);
  const variants = useVariants();
  const paid = usePaidWallpaper();

  // Computed
  const allChecked = list.images.length > 0 && actions.selectedIds.size === list.images.length;
  const someChecked = actions.selectedIds.size > 0 && actions.selectedIds.size < list.images.length;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <StatsCards
        stats={list.stats}
        loading={list.loading}
        variantStatus={variants.variantStatus}
        variantGenerating={variants.variantGenerating}
        onGenerateVariants={variants.handleGenerateVariants}
      />

      {/* Main Content */}
      <Card>
        <ImageListToolbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLoadDuplicates={duplicates.loadDuplicates}
          searchQuery={list.searchQuery}
          setSearchQuery={list.setSearchQuery}
          categoryFilter={list.categoryFilter}
          setCategoryFilter={list.setCategoryFilter}
          categories={list.categories}
          variantGenerating={variants.variantGenerating}
          onGenerateVariants={variants.handleGenerateVariants}
          onSetPage={list.setPage}
        />
        <CardContent>
          {activeTab === "duplicates" ? (
            <DuplicatesPanel
              duplicateLoading={duplicates.duplicateLoading}
              duplicateGroups={duplicates.duplicateGroups}
              duplicateDeleteIds={duplicates.duplicateDeleteIds}
              duplicateDeleting={duplicates.duplicateDeleting}
              onToggleDuplicateSelect={duplicates.toggleDuplicateSelect}
              onSetDuplicateDeleteIds={duplicates.setDuplicateDeleteIds}
              onHandleDuplicateDelete={duplicates.handleDuplicateDelete}
            />
          ) : (
            <ImageTable
              images={list.images}
              categories={list.categories}
              loading={list.loading}
              selectedIds={actions.selectedIds}
              allChecked={allChecked}
              someChecked={someChecked}
              page={list.page}
              totalPages={list.totalPages}
              total={list.total}
              pageSize={list.pageSize}
              jumpPage={list.jumpPage}
              paidImagesMap={paid.paidImagesMap}
              onToggleSelect={actions.toggleSelect}
              onToggleSelectAll={() => actions.toggleSelectAll(list.images)}
              onSetPage={list.setPage}
              onSetPageSize={list.setPageSize}
              onSetJumpPage={list.setJumpPage}
              onSetSelectedIds={actions.setSelectedIds}
              onSetBatchDeleteConfirmOpen={actions.setBatchDeleteConfirmOpen}
              onOpenDetail={(image) => {
                actions.setSelectedImage(image);
                actions.setDetailOpen(true);
              }}
              onOpenEdit={actions.openEdit}
              onDelete={actions.handleDelete}
              onOpenPaidDialog={paid.openPaidDialog}
              onUnsetPaid={paid.handleUnsetPaid}
              onSetUploadOpen={actions.setUploadOpen}
            />
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <ImageUploadDialog
        open={actions.uploadOpen}
        onOpenChange={actions.setUploadOpen}
        uploadMode={actions.uploadMode}
        setUploadMode={actions.setUploadMode}
        uploadForm={actions.uploadForm}
        setUploadForm={actions.setUploadForm}
        previewUrl={actions.previewUrl}
        uploading={actions.uploading}
        categories={list.categories}
        onFileSelect={actions.handleFileSelect}
        onUrlPreview={actions.handleUrlPreview}
        onSubmit={actions.handleUpload}
      />

      {/* Detail Dialog */}
      <ImageDetailDialog
        open={actions.detailOpen}
        onOpenChange={actions.setDetailOpen}
        image={actions.selectedImage}
        categories={list.categories}
        onToggleFavorite={actions.toggleFavorite}
        onOpenEdit={(image) => {
          actions.openEdit(image);
          actions.setDetailOpen(false);
        }}
        onDelete={actions.handleDelete}
      />

      {/* Batch Delete Confirm Dialog */}
      <Dialog open={actions.batchDeleteConfirmOpen} onOpenChange={actions.setBatchDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">确认批量删除</DialogTitle>
            <DialogDescription>
              您确定要删除选中的 {actions.selectedIds.size} 张图片吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => actions.setBatchDeleteConfirmOpen(false)}
              className="rounded-full"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={actions.batchDeleting}
              onClick={actions.handleBatchDelete}
              className="rounded-full gap-2"
            >
              {actions.batchDeleting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  确认删除 {actions.selectedIds.size} 张图片
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <ImageEditDialog
        open={actions.editOpen}
        onOpenChange={actions.setEditOpen}
        editForm={actions.editForm}
        setEditForm={actions.setEditForm}
        editSaving={actions.editSaving}
        categories={list.categories}
        onSave={actions.handleEditSave}
      />

      {/* Paid Wallpaper Dialog */}
      <PaidDialog
        open={paid.paidDialogOpen}
        onOpenChange={paid.setPaidDialogOpen}
        paidTargetImage={paid.paidTargetImage}
        paidPrice={paid.paidPrice}
        setPaidPrice={paid.setPaidPrice}
        paidSaving={paid.paidSaving}
        paidImagesMap={paid.paidImagesMap}
        selectedIds={actions.selectedIds}
        onConfirm={paid.handleSetPaid}
        onBatchConfirm={paid.handleBatchSetPaid}
      />
    </div>
  );
}
