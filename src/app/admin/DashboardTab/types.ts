export interface OverviewData {
  totalUsers: number;
  totalImages: number;
  totalDownloads: number;
  totalFavorites: number;
  totalViews: number;
  pendingReview: number;
  openReports: number;
  recentComments: number;
  recentActiveUsers: number;
  nsfwFlagged: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TrendData {
  newUsers: TrendPoint[];
  newImages: TrendPoint[];
  downloads: TrendPoint[];
  uploads: TrendPoint[];
}

export interface CategoryItem {
  name: string;
  slug: string;
  count: number;
}

export interface TopImage {
  id: number;
  title: string;
  thumbnailUrl: string;
  downloadCount: number;
  viewCount: number;
  width: number;
  height: number;
  category: string;
}

export interface TopCreator {
  userId: number;
  name: string;
  avatar: string;
  uploadCount: number;
  totalDownloads: number;
  totalViews: number;
}

export interface StorageInfo {
  totalSize: number;
  fileCount: number;
}

export interface MediaTypeItem {
  type: string;
  count: number;
}

export interface ResolutionItem {
  resolution: string;
  count: number;
}

export interface RecentUser {
  id: number;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
}

export interface StatsData {
  overview: OverviewData;
  trends: TrendData;
  categoryDistribution: CategoryItem[];
  topImages: TopImage[];
  topCreators: TopCreator[];
  storage: StorageInfo;
  mediaTypes: MediaTypeItem[];
  resolutions: ResolutionItem[];
  recentUsers: RecentUser[];
}
