"use client";

import type { GalleryImage } from "@/data/images";
import { motion } from "framer-motion";
import { X, MonitorSmartphone } from "lucide-react";
import DeviceMockup, { type DeviceType } from "../DeviceMockup";
import DeviceSelector from "../DeviceSelector";

interface ImageDisplayProps {
  currentImage: GalleryImage;
  devicePreview: boolean;
  setDevicePreview: (v: boolean) => void;
  selectedDevice: DeviceType;
  setSelectedDevice: (d: DeviceType) => void;
  similarOpen: boolean;
  commentOpen: boolean;
}

export default function ImageDisplay({
  currentImage,
  devicePreview,
  setDevicePreview,
  selectedDevice,
  setSelectedDevice,
  similarOpen,
  commentOpen,
}: ImageDisplayProps) {
  return (
    <motion.div
      key={`image-container-${currentImage.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: (similarOpen || commentOpen) ? 0.85 : 1,
        x: 0,
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className={`relative max-w-[95vw] sm:max-w-[90vw] flex flex-col items-center justify-center pb-24 sm:pb-20`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 设备预览切换按钮 */}
      {!devicePreview && currentImage.media_type !== "video" && (
        <button
          onClick={(e) => { e.stopPropagation(); setDevicePreview(true); }}
          className="absolute top-3 right-3 z-10 px-3 py-1.5 flex items-center gap-1.5 rounded-full bg-black/50 text-white/80 text-xs font-medium hover:bg-black/70 hover:text-white transition-colors backdrop-blur-sm"
        >
          <MonitorSmartphone className="w-3.5 h-3.5" />
          设备预览
        </button>
      )}

      {/* 设备预览模式 */}
      {devicePreview ? (
        <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setDevicePreview(false)}
            className="px-3 py-1.5 flex items-center gap-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 hover:text-white transition-colors backdrop-blur-sm"
          >
            <X className="w-3.5 h-3.5" />
            退出设备预览
          </button>

          <DeviceMockup
            imageUrl={currentImage.src}
            imageWidth={currentImage.width}
            imageHeight={currentImage.height}
            deviceType={selectedDevice}
          />

          <DeviceSelector
            selected={selectedDevice}
            onSelect={setSelectedDevice}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center relative overflow-hidden max-h-[70vh] sm:max-h-[75vh]">
          {currentImage.media_type === "video" && currentImage.video_url ? (
            <video
              key={`video-${currentImage.id}`}
              src={currentImage.video_url}
              poster={currentImage.poster_url || currentImage.src}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg sm:rounded-2xl shadow-2xl"
            />
          ) : (
            <img
              src={currentImage.src}
              alt={currentImage.title}
              className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg sm:rounded-2xl shadow-2xl"
            />
          )}

          {currentImage.media_type === "video" && (
            <div className="absolute top-3 left-3">
              <span className="text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-1 rounded-full">
                LIVE
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
