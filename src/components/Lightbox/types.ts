import type { GalleryImage } from "@/data/images";
import type { Resolution } from "@/lib/resolutions";

export interface LightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  favoritedIds?: Set<number>;
  onToggleFavorite?: (id: number) => void;
  onJumpToImage?: (imageId: number, imageData?: GalleryImage) => void;
}

export interface ResolutionWithCache extends Resolution {
  cached?: boolean;
}

export const REPORT_CATEGORIES = [
  { value: "inappropriate", label: "不当内容" },
  { value: "copyright", label: "版权侵权" },
  { value: "spam", label: "垃圾信息" },
  { value: "violence", label: "暴力血腥" },
  { value: "other", label: "其他" },
] as const;
