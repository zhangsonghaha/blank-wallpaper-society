"use client";

import type { GalleryImage } from "@/data/images";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

interface ImageInfoProps {
  currentImage: GalleryImage;
  exifOpen: boolean;
  setExifOpen: (v: boolean) => void;
}

export default function ImageInfo({ currentImage, exifOpen, setExifOpen }: ImageInfoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-3 sm:mt-4 text-white text-center max-w-sm sm:max-w-lg px-4 w-full"
    >
      <h3 className="text-base sm:text-xl font-semibold">{currentImage.title}</h3>
      <p className="text-xs sm:text-sm text-white/70 mt-1 line-clamp-2">{currentImage.description}</p>
      <div className="flex items-center justify-center gap-2 sm:gap-3 mt-2 sm:mt-3 flex-wrap">
        <Link
          href={currentImage.uploaded_by ? `/creator/${currentImage.uploaded_by}` : "#"}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded-full bg-white/20 overflow-hidden">
            <img src={currentImage.avatar} alt={currentImage.author} className="w-full h-full object-cover" />
          </div>
          <span className="text-sm text-white/80">{currentImage.author}</span>
        </Link>
        <span className="text-white/30">·</span>
        <div className="flex flex-wrap justify-center gap-1">
          {currentImage.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/15 text-white/70">
              #{tag}
            </span>
          ))}
        </div>
      </div>
      {/* EXIF Info */}
      {currentImage.exif && (currentImage.exif.camera || currentImage.exif.lens || currentImage.exif.focalLength || currentImage.exif.aperture || currentImage.exif.iso) && (
        <div className="mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); setExifOpen(!exifOpen); }}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors mx-auto"
          >
            <Camera className="w-3 h-3" />
            <span>EXIF 信息</span>
            {exifOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <AnimatePresence>
            {exifOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {currentImage.exif.camera && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 shrink-0">相机</span>
                      <span className="text-white/90 truncate">{currentImage.exif.camera}</span>
                    </div>
                  )}
                  {currentImage.exif.lens && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 shrink-0">镜头</span>
                      <span className="text-white/90 truncate">{currentImage.exif.lens}</span>
                    </div>
                  )}
                  {currentImage.exif.focalLength && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 shrink-0">焦距</span>
                      <span className="text-white/90">{currentImage.exif.focalLength}mm</span>
                    </div>
                  )}
                  {currentImage.exif.aperture && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 shrink-0">光圈</span>
                      <span className="text-white/90">f/{currentImage.exif.aperture}</span>
                    </div>
                  )}
                  {currentImage.exif.shutterSpeed && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 shrink-0">快门</span>
                      <span className="text-white/90">{currentImage.exif.shutterSpeed}</span>
                    </div>
                  )}
                  {currentImage.exif.iso && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/50 shrink-0">ISO</span>
                      <span className="text-white/90">{currentImage.exif.iso}</span>
                    </div>
                  )}
                  {currentImage.exif.dateTaken && (
                    <div className="flex items-center gap-2 col-span-2">
                      <span className="text-white/50 shrink-0">拍摄时间</span>
                      <span className="text-white/90">{currentImage.exif.dateTaken}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
