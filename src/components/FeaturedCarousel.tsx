"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Eye, Download, Star } from "lucide-react";
import Link from "next/link";

interface CarouselImage {
  id: number;
  title: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  category: string;
  view_count: number;
  download_count: number;
  dominant_color: string | null;
  author_name: string | null;
  author_avatar: string | null;
}

export default function FeaturedCarousel() {
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    fetch("/api/discover/featured-carousel")
      .then((res) => res.json())
      .then((data) => setImages(data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (images.length <= 1 || isHovering) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length, isHovering]);

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex((index + images.length) % images.length);
    },
    [images.length]
  );

  if (images.length === 0) return null;

  const current = images[currentIndex];

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden bg-[var(--color-surface-card)]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <Link href={`/?pin=${current.id}`} className="block">
            <div className="relative aspect-[21/9] md:aspect-[3/1]">
              <img
                src={current.thumbnail_url || current.url}
                alt={current.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider">
                    编辑精选
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-1 line-clamp-1">
                  {current.title}
                </h2>
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  {current.author_name && <span>by {current.author_name}</span>}
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{current.view_count}</span>
                  <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" />{current.download_count}</span>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>

      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.preventDefault(); goTo(currentIndex - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors z-10">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={(e) => { e.preventDefault(); goTo(currentIndex + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors z-10">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 right-6 flex items-center gap-1.5 z-10">
            {images.map((_, idx) => (
              <button key={idx} onClick={(e) => { e.preventDefault(); goTo(idx); }} className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}