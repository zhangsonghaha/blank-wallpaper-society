export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface ImageRecord {
  id: number;
  title: string;
  description: string;
  filename: string;
  storage_key: string;
  url: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  author: string;
  tags: string;
  category: string;
  is_favorite: number;
  view_count: number;
  created_at: string;
}

export interface UploadForm {
  file: File | null;
  url: string;
  title: string;
  description: string;
  author: string;
  tags: string;
  category: string;
}

export interface EditForm {
  id: number;
  title: string;
  description: string;
  author: string;
  tags: string;
  category: string;
}

export interface ImageStats {
  totalImages: number;
  totalViews: number;
  totalFavorites: number;
  totalCategories: number;
}

export interface VariantStatus {
  totalImages: number;
  withVariants: number;
  withoutVariants: number;
  progress: number;
}

export interface PaidImageInfo {
  price: number;
  is_paid: boolean;
}
