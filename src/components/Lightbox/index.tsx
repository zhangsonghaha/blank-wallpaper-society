"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DeviceType } from "../DeviceMockup";
import AddToCollectionDialog from "../AddToCollectionDialog";
import CommentSection from "../CommentSection";
import SimilarImages from "../SimilarImages";
import PaymentDialog from "../PaymentDialog";
import DownloadSuccessGuide from "../DownloadSuccessGuide";
import SocialShare from "../SocialShare";

import type { LightboxProps } from "./types";
import { useLightbox } from "./useLightbox";
import { useResolutions } from "./useResolutions";
import LightboxOverlay from "./LightboxOverlay";
import ImageDisplay from "./ImageDisplay";
import ImageInfo from "./ImageInfo";
import ActionBar from "./ActionBar";
import ReportDialog from "./ReportDialog";

export default function Lightbox(props: LightboxProps) {
  const lb = useLightbox(props);

  const [selectedDevice, setSelectedDevice] = useState<DeviceType>("desktop");

  const res = useResolutions(
    lb.currentImage,
    lb.isPaidWallpaper,
    lb.hasPurchased,
    () => lb.setPaymentDialogOpen(true),
  );

  // Escape 关闭下载面板（优先于 useLightbox 的键盘处理）
  const handleDownloadEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && res.downloadPanelOpen) {
        e.stopImmediatePropagation();
        res.setDownloadPanelOpen(false);
      }
    },
    [res.downloadPanelOpen, res.setDownloadPanelOpen],
  );

  useEffect(() => {
    if (props.isOpen) {
      document.addEventListener("keydown", handleDownloadEscape, true);
      return () => document.removeEventListener("keydown", handleDownloadEscape, true);
    }
  }, [props.isOpen, handleDownloadEscape]);

  return (
    <>
      <AnimatePresence mode="wait">
        {props.isOpen && lb.currentImage && (
          <motion.div
            key={`lightbox-${lb.currentImage.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="contents"
          >
            <LightboxOverlay
              activeIndex={lb.activeIndex}
              totalImages={lb.allImages.length}
              similarOpen={lb.similarOpen}
              commentOpen={lb.commentOpen}
              downloadPanelOpen={res.downloadPanelOpen}
              onClose={props.onClose}
              onPrev={props.onPrev}
              onNext={props.onNext}
              setDownloadPanelOpen={res.setDownloadPanelOpen}
              setSimilarOpen={lb.setSimilarOpen}
              setCommentOpen={lb.setCommentOpen}
            >
              <ImageDisplay
                currentImage={lb.currentImage}
                devicePreview={lb.devicePreview}
                setDevicePreview={lb.setDevicePreview}
                selectedDevice={selectedDevice}
                setSelectedDevice={setSelectedDevice}
                similarOpen={lb.similarOpen}
                commentOpen={lb.commentOpen}
              />

              <ImageInfo
                currentImage={lb.currentImage}
                exifOpen={lb.exifOpen}
                setExifOpen={lb.setExifOpen}
              />

              <ActionBar
                currentImage={lb.currentImage}
                isFavorited={lb.isFavorited}
                isPaidWallpaper={lb.isPaidWallpaper}
                hasPurchased={lb.hasPurchased}
                paidPrice={lb.paidPrice}
                isFollowing={lb.isFollowing}
                loadingFollowStatus={lb.loadingFollowStatus}
                downloadPanelOpen={res.downloadPanelOpen}
                setDownloadPanelOpen={res.setDownloadPanelOpen}
                loadingResolutions={res.loadingResolutions}
                groupedResolutions={res.groupedResolutions}
                recommendedResolution={res.recommendedResolution}
                downloadingRes={res.downloadingRes}
                downloadProgress={res.downloadProgress}
                downloadBtnRef={res.downloadBtnRef}
                downloadPanelRef={res.downloadPanelRef}
                downloadPanelPos={res.downloadPanelPos}
                handleDownloadResolution={res.handleDownloadResolution}
                handleFavorite={lb.handleFavorite}
                handleToggleFollow={lb.handleToggleFollow}
                onToggleFavorite={props.onToggleFavorite}
                setReportOpen={lb.setReportOpen}
                setAddToCollectionOpen={lb.setAddToCollectionOpen}
                setShareOpen={lb.setShareOpen}
                setCommentOpen={lb.setCommentOpen}
                setSimilarOpen={lb.setSimilarOpen}
                setPaymentDialogOpen={lb.setPaymentDialogOpen}
              />

              <ReportDialog
                reportOpen={lb.reportOpen}
                setReportOpen={lb.setReportOpen}
                reportCategory={lb.reportCategory}
                setReportCategory={lb.setReportCategory}
                reportReason={lb.reportReason}
                setReportReason={lb.setReportReason}
                submitting={lb.submitting}
                handleReport={lb.handleReport}
              />
            </LightboxOverlay>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to Collection Dialog */}
      <AddToCollectionDialog
        open={lb.addToCollectionOpen}
        onOpenChange={lb.setAddToCollectionOpen}
        imageId={lb.currentImage?.id ?? null}
      />

      {/* Comment Section */}
      {lb.currentImage && (
        <CommentSection
          imageId={lb.currentImage.id}
          isOpen={lb.commentOpen}
          onClose={() => lb.setCommentOpen(false)}
        />
      )}

      {/* Similar Images Panel */}
      {lb.currentImage && (
        <SimilarImages
          imageId={lb.currentImage.id}
          isOpen={lb.similarOpen}
          onClose={() => lb.setSimilarOpen(false)}
          onImageClick={lb.handleSimilarImageClick}
        />
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={lb.paymentDialogOpen}
        onClose={() => lb.setPaymentDialogOpen(false)}
        orderType="paid_wallpaper"
        description={lb.currentImage?.title || "付费壁纸"}
        amount={lb.paidPrice}
        relatedId={lb.currentImage?.id}
        onSuccess={() => {
          lb.setHasPurchased(true);
          lb.setPaymentDialogOpen(false);
        }}
      />

      {/* Download Success Guide */}
      {lb.currentImage && (
        <DownloadSuccessGuide
          imageId={lb.currentImage.id}
          imageTitle={lb.currentImage.title}
          uploadedBy={lb.currentImage.uploaded_by ?? null}
          authorName={lb.currentImage.author}
          isOpen={lb.downloadSuccessOpen}
          onClose={() => lb.setDownloadSuccessOpen(false)}
          isFavorited={lb.isFavorited}
          isFollowing={lb.isFollowing}
        />
      )}

      {/* Social Share Modal */}
      {lb.currentImage && (
        <SocialShare
          imageId={lb.currentImage.id}
          imageTitle={lb.currentImage.title}
          imageUrl={lb.currentImage.src}
          isOpen={lb.shareOpen}
          onClose={() => lb.setShareOpen(false)}
        />
      )}
    </>
  );
}
