"use client";

interface LightboxOverlayProps {
  activeIndex: number;
  totalImages: number;
  similarOpen: boolean;
  commentOpen: boolean;
  downloadPanelOpen: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  setDownloadPanelOpen: (v: boolean) => void;
  setSimilarOpen: (v: boolean) => void;
  setCommentOpen: (v: boolean) => void;
  children: React.ReactNode;
}

export default function LightboxOverlay({
  activeIndex,
  totalImages,
  similarOpen,
  commentOpen,
  downloadPanelOpen,
  onClose,
  onPrev,
  onNext,
  setDownloadPanelOpen,
  setSimilarOpen,
  setCommentOpen,
  children,
}: LightboxOverlayProps) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm ${similarOpen || commentOpen ? "bg-black/10" : "bg-black/85"}`}
      onClick={() => {
        if (downloadPanelOpen) {
          setDownloadPanelOpen(false);
        } else if (similarOpen) {
          setSimilarOpen(false);
        } else if (commentOpen) {
          setCommentOpen(false);
        } else {
          onClose();
        }
      }}
    >
      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/40 text-white text-sm font-medium">
        {activeIndex + 1} / {totalImages}
      </div>

      {/* Prev Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all hover:scale-105"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Next Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all hover:scale-105"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {children}
    </div>
  );
}
